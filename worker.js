
const ALLOWED_ORIGINS = [
  "https://nemesvill.eu",
  "https://www.nemesvill.eu"
];

const COOKIE_NAME = "nemesvill_session";
const SESSION_SECONDS = 8 * 60 * 60;

const CUSTOMER_FIELDS = [
  "customer_type",
  "name",
  "company_name",
  "tax_number",
  "email",
  "phone",
  "postal_code",
  "city",
  "street_address",
  "notes"
];

const LEAD_FIELDS = [
  "customer_id",
  "service_type",
  "source",
  "status",
  "subject",
  "description",
  "preferred_date",
  "location_text",
  "follow_up_at"
];

const JOB_FIELDS = [
  "customer_id",
  "lead_id",
  "service_type",
  "status",
  "title",
  "description",
  "scheduled_start",
  "scheduled_end",
  "address_text",
  "labor_minutes",
  "notes"
];

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64url(value) {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");

  return Uint8Array.from(
    atob(s + "=".repeat((4 - s.length % 4) % 4)),
    c => c.charCodeAt(0)
  );
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return base64url(new Uint8Array(signature));
}

async function createSession(env) {
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        email: env.ADMIN_EMAIL,
        exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
      })
    )
  );

  return payload + "." + await sign(payload, env.SESSION_SECRET);
}

async function verifySession(request, env) {
  const raw = request.headers.get("Cookie") || "";
  const match = raw.match(/(?:^|;\s*)nemesvill_session=([^;]+)/);

  if (!match) return false;

  try {
    const parts = match[1].split(".");
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    const expected = await sign(payload, env.SESSION_SECRET);

    if (signature !== expected) return false;

    const data = JSON.parse(
      new TextDecoder().decode(decodeBase64url(payload))
    );

    return (
      data.email === env.ADMIN_EMAIL &&
      data.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

function cookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function cleanFields(input, allowed) {
  const out = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input || {}, key)) {
      out[key] = input[key] === "" ? null : input[key];
    }
  }

  return out;
}

function placeholders(n) {
  return Array(n).fill("?").join(", ");
}

async function generateJobNumber(db) {
  const year = new Date().getFullYear();

  const counter = await db.prepare(`
    INSERT INTO job_counters (year, last_number)
    VALUES (?, 1)
    ON CONFLICT(year)
    DO UPDATE SET last_number = last_number + 1
    RETURNING last_number
  `).bind(year).first();

  return `NV-${year}-${String(counter.last_number).padStart(4, "0")}`;
}


async function generateQuoteNumber(db) {
  const year = new Date().getFullYear();
  const counter = await db.prepare(`
    INSERT INTO quote_counters (year, last_number)
    VALUES (?, 1)
    ON CONFLICT(year)
    DO UPDATE SET last_number = last_number + 1
    RETURNING last_number
  `).bind(year).first();
  return `NV-A-${year}-${String(counter.last_number).padStart(4, "0")}`;
}

function normalizeQuoteItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new Error("Legalább egy, legfeljebb 100 ajánlati tétel szükséges.");
  }
  return items.map((item, index) => {
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity ?? 1);
    const unitNetPrice = Number(item.unit_net_price ?? item.unit_price ?? 0);
    const itemType = item.item_type || "service";
    if (!description) throw new Error("Minden tétel megnevezése kötelező.");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error("Érvénytelen mennyiség.");
    if (!Number.isSafeInteger(unitNetPrice) || unitNetPrice < 0) throw new Error("Az egységár csak nulla vagy pozitív egész forint lehet.");
    if (!["material", "service", "travel", "other"].includes(itemType)) throw new Error("Érvénytelen tételtípus.");
    const lineNet = Math.round(quantity * unitNetPrice);
    return {
      id: crypto.randomUUID(), sort_order: index, item_type: itemType,
      description, quantity, unit: String(item.unit || "db").slice(0, 30),
      unit_net_price: unitNetPrice, vat_rate: 0, line_net: lineNet,
      line_vat: 0, line_gross: lineNet
    };
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return cors["Access-Control-Allow-Origin"]
        ? new Response(null, { status: 204, headers: cors })
        : new Response(null, { status: 403 });
    }

    if (
      !env.DB ||
      !env.ADMIN_EMAIL ||
      !env.ADMIN_PASSWORD ||
      !env.SESSION_SECRET
    ) {
      return json(
        { error: "Server configuration error. Check DB binding and secrets." },
        500,
        cors
      );
    }

    // API állapot
    if (url.pathname === "/" && request.method === "GET") {
      return json({
        name: "Nemesvill CRM API",
        status: "running",
        version: "2.0.0"
      }, 200, cors);
    }

    // Bejelentkezés
    if (url.pathname === "/api/login" && request.method === "POST") {
      if (!cors["Access-Control-Allow-Origin"]) {
        return json({ error: "Origin not allowed." }, 403);
      }

      const data = await readBody(request);

      if (
        !data ||
        typeof data.email !== "string" ||
        typeof data.password !== "string"
      ) {
        return json(
          { error: "Érvénytelen belépési adatok." },
          400,
          cors
        );
      }

      if (
        data.email.trim().toLowerCase() !==
          env.ADMIN_EMAIL.trim().toLowerCase() ||
        data.password !== env.ADMIN_PASSWORD
      ) {
        return json(
          { error: "Hibás e-mail-cím vagy jelszó." },
          401,
          cors
        );
      }

      const session = await createSession(env);

      return json(
        { success: true },
        200,
        {
          ...cors,
          "Set-Cookie": cookie(session, SESSION_SECONDS)
        }
      );
    }

    // Munkamenet ellenőrzése
    if (url.pathname === "/api/session" && request.method === "GET") {
      const valid = await verifySession(request, env);

      if (!valid) {
        return json(
          { error: "Nincs érvényes bejelentkezés." },
          401,
          cors
        );
      }

      return json(
        { success: true, email: env.ADMIN_EMAIL },
        200,
        cors
      );
    }

    // Kijelentkezés
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return json(
        { success: true },
        200,
        {
          ...cors,
          "Set-Cookie": cookie("", 0)
        }
      );
    }

    const authenticated = await verifySession(request, env);

    if (url.pathname === "/api/admin/check" && request.method === "GET") {
      return json(
        { authenticated },
        authenticated ? 200 : 401,
        cors
      );
    }

    if (!authenticated) {
      return json({ error: "Nincs bejelentkezve." }, 401, cors);
    }

    try {
      // Adatbázis ellenőrzése
      if (url.pathname === "/api/db-check" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();

        return json({
          success: true,
          database: "connected",
          test: result?.ok === 1
        }, 200, cors);
      }

      // Pénzügyi áttekintő: havi vagy éves nézet
      if (url.pathname === "/api/financial" && request.method === "GET") {
        const period = url.searchParams.get("period") === "year" ? "year" : "month";
        const today = new Date().toISOString();
        const month = url.searchParams.get("month") || today.slice(0,7);
        const year = url.searchParams.get("year") || today.slice(0,4);
        if (period === "month" && !/^\d{4}-\d{2}$/.test(month)) return json({error:"Érvénytelen hónap."},400,cors);
        if (period === "year" && !/^\d{4}$/.test(year)) return json({error:"Érvénytelen év."},400,cors);
        const start = period === "year" ? year + "-01-01" : month + "-01";
        const end = period === "year" ? String(Number(year)+1) + "-01-01" : new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10);
        const income = await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN income_date >= ? AND income_date < ? THEN gross_amount ELSE 0 END),0) AS invoiced, COALESCE(SUM(CASE WHEN paid=1 AND paid_date >= ? AND paid_date < ? THEN gross_amount ELSE 0 END),0) AS received, COALESCE(SUM(CASE WHEN paid=0 THEN gross_amount ELSE 0 END),0) AS receivable FROM income_records").bind(start,end,start,end).first();
        const expenses = await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN expense_date >= ? AND expense_date < ? THEN gross_amount ELSE 0 END),0) AS recorded, COALESCE(SUM(CASE WHEN paid=1 AND paid_date >= ? AND paid_date < ? THEN gross_amount ELSE 0 END),0) AS paid, COALESCE(SUM(CASE WHEN paid=0 THEN gross_amount ELSE 0 END),0) AS unpaid, COALESCE(SUM(CASE WHEN paid IS NULL THEN gross_amount ELSE 0 END),0) AS unknown_paid FROM expenses").bind(start,end,start,end).first();
        const costPeriod = period === "year" ? year : month;
        const costFormat = period === "year" ? "substr(created_at,1,4)" : "substr(created_at,1,7)";
        const costs = await env.DB.prepare("SELECT cost_type, COALESCE(SUM(ROUND(quantity*unit_net_cost)),0) AS total FROM job_cost_items WHERE "+costFormat+"=? GROUP BY cost_type").bind(costPeriod).all();
        const jobCosts={material:0,labor:0,travel:0,other:0};
        for(const row of costs.results||[]) if(Object.prototype.hasOwnProperty.call(jobCosts,row.cost_type)) jobCosts[row.cost_type]=Number(row.total||0);
        const incomeSeries = await env.DB.prepare("SELECT substr(paid_date,1,7) AS period, SUM(gross_amount) AS total FROM income_records WHERE paid=1 AND paid_date>=? AND paid_date<? GROUP BY substr(paid_date,1,7)").bind(start,end).all();
        const expenseSeries = await env.DB.prepare("SELECT substr(paid_date,1,7) AS period, SUM(gross_amount) AS total FROM expenses WHERE paid=1 AND paid_date>=? AND paid_date<? GROUP BY substr(paid_date,1,7)").bind(start,end).all();
        const seriesMap={};
        const count=period==="year"?12:1;
        for(let i=0;i<count;i++){
          const key=period==="year"?year+"-"+String(i+1).padStart(2,"0"):month;
          seriesMap[key]={period:key,received:0,paid:0};
        }
        for(const row of incomeSeries.results||[]) if(seriesMap[row.period]) seriesMap[row.period].received=Number(row.total||0);
        for(const row of expenseSeries.results||[]) if(seriesMap[row.period]) seriesMap[row.period].paid=Number(row.total||0);
        return json({period,month,year,income:{invoiced:Number(income?.invoiced||0),received:Number(income?.received||0),receivable:Number(income?.receivable||0)},expenses:{recorded:Number(expenses?.recorded||0),paid:Number(expenses?.paid||0),unpaid:Number(expenses?.unpaid||0),unknown_paid:Number(expenses?.unknown_paid||0)},job_costs:jobCosts,series:Object.values(seriesMap),cash_result:Number(income?.received||0)-Number(expenses?.paid||0),tax_mode:"AAM"},200,cors);
      }

      // Kiadások listázása és rögzítése
      if (url.pathname === "/api/expenses" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT expenses.*, jobs.job_number FROM expenses LEFT JOIN jobs ON jobs.id=expenses.job_id ORDER BY expense_date DESC, created_at DESC LIMIT 500").all();
        return json({items:result.results||[],tax_mode:"AAM"},200,cors);
      }
      if (url.pathname === "/api/expenses" && request.method === "POST") {
        const data = await readBody(request)||{};
        const date=String(data.expense_date||"").trim(), category=String(data.category||"").trim().slice(0,80), description=String(data.description||"").trim().slice(0,500), amount=Number(data.gross_amount);
        const supplier=String(data.supplier||"").trim().slice(0,200)||null, ref=String(data.document_ref||"").trim().slice(0,100)||null, jobId=data.job_id||null;
        const paid=data.paid===true||data.paid==="1"?1:(data.paid===false||data.paid==="0"?0:null), paidDate=paid===1?String(data.paid_date||"").trim():null;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({error:"Érvényes kiadási dátum szükséges."},400,cors);
        if(!category||!description) return json({error:"A kategória és megnevezés kötelező."},400,cors);
        if(!Number.isSafeInteger(amount)||amount<0) return json({error:"Az összeg nulla vagy pozitív egész forint legyen."},400,cors);
        if(paid===1&&!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return json({error:"A fizetés dátuma kötelező."},400,cors);
        if(jobId&&!(await env.DB.prepare("SELECT id FROM jobs WHERE id=?").bind(jobId).first())) return json({error:"A kapcsolódó munka nem található."},400,cors);
        const id=crypto.randomUUID();
        await env.DB.prepare("INSERT INTO expenses (id,job_id,expense_date,category,description,net_amount,vat_amount,gross_amount,supplier,document_ref,paid,paid_date) VALUES (?,?,?,?,?,?,0,?,?,?,?,?)").bind(id,jobId,date,category,description,amount,amount,supplier,ref,paid,paidDate).run();
        return json({success:true,id,tax_mode:"AAM"},201,cors);
      }
      const expenseMatch=url.pathname.match(/^\/api\/expenses\/([^/]+)$/);
      if(expenseMatch&&request.method==="PUT"){
        const data=await readBody(request)||{}, paid=data.paid?1:0, date=paid?String(data.paid_date||"").trim():null;
        if(paid&&!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({error:"A fizetés dátuma kötelező."},400,cors);
        const result=await env.DB.prepare("UPDATE expenses SET paid=?,paid_date=? WHERE id=?").bind(paid,date,expenseMatch[1]).run();
        if(!result.meta?.changes)return json({error:"A kiadás nem található."},404,cors);
        return json({success:true},200,cors);
      }
      if(expenseMatch&&request.method==="DELETE"){
        const result=await env.DB.prepare("DELETE FROM expenses WHERE id=?").bind(expenseMatch[1]).run();
        if(!result.meta?.changes)return json({error:"A kiadás nem található."},404,cors);
        return json({success:true},200,cors);
      }

      // Vezérlőpult számlálói
      if (url.pathname === "/api/dashboard" && request.method === "GET") {
        const customers = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL"
        ).first();

        const leads = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM leads"
        ).first();

        return json({
          counts: {
            customers: customers?.n || 0,
            leads: leads?.n || 0
          }
        }, 200, cors);
      }

      // Árajánlatok listázása
      if (url.pathname === "/api/quotes" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT quotes.*, customers.name AS customer_name,
                 customers.company_name AS customer_company_name
          FROM quotes LEFT JOIN customers ON customers.id = quotes.customer_id
          ORDER BY quotes.created_at DESC LIMIT 300
        `).all();
        const items = result.results || [];
        return json({ items, quotes: items }, 200, cors);
      }

      // Új árajánlat – minden tétel AAM, az összegeket a szerver számolja
      if (url.pathname === "/api/quotes" && request.method === "POST") {
        const data = await readBody(request) || {};
        if (!data.customer_id) return json({ error: "Az ügyfél kiválasztása kötelező." }, 400, cors);
        const customer = await env.DB.prepare(
          "SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL"
        ).bind(data.customer_id).first();
        if (!customer) return json({ error: "Az ügyfél nem található." }, 400, cors);

        if (data.lead_id) {
          const lead = await env.DB.prepare("SELECT id, customer_id FROM leads WHERE id = ?")
            .bind(data.lead_id).first();
          if (!lead || (lead.customer_id && lead.customer_id !== data.customer_id)) {
            return json({ error: "A kapcsolódó érdeklődés nem található vagy másik ügyfélhez tartozik." }, 400, cors);
          }
        }

        let items;
        try { items = normalizeQuoteItems(data.items); }
        catch (error) { return json({ error: error.message }, 400, cors); }

        const netTotal = items.reduce((sum, item) => sum + item.line_net, 0);
        if (!Number.isSafeInteger(netTotal)) return json({ error: "Az ajánlat végösszege túl nagy." }, 400, cors);

        const id = crypto.randomUUID();
        const quoteNumber = await generateQuoteNumber(env.DB);
        const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(data.issue_date || "")
          ? data.issue_date : new Date().toISOString().slice(0, 10);
        const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(data.valid_until || "") ? data.valid_until : null;

        const statements = [env.DB.prepare(`
          INSERT INTO quotes (
            id, customer_id, lead_id, quote_number, status, issue_date,
            valid_until, currency, notes, net_total, vat_total, gross_total,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'draft', ?, ?, 'HUF', ?, ?, 0, ?, datetime('now'), datetime('now'))
        `).bind(id, data.customer_id, data.lead_id || null, quoteNumber,
          issueDate, validUntil, data.notes ? String(data.notes).slice(0, 5000) : null,
          netTotal, netTotal)];

        for (const item of items) {
          statements.push(env.DB.prepare(`
            INSERT INTO quote_items (
              id, quote_id, sort_order, item_type, description, quantity, unit,
              unit_net_price, vat_rate, line_net, line_vat, line_gross
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?)
          `).bind(item.id, id, item.sort_order, item.item_type, item.description,
            item.quantity, item.unit, item.unit_net_price, item.line_net, item.line_gross));
        }
        await env.DB.batch(statements);
        return json({ success: true, id, quote_number: quoteNumber, tax_mode: "AAM",
          net_total: netTotal, vat_total: 0, gross_total: netTotal }, 201, cors);
      }

      // Elfogadott ajánlat átalakítása munkává
      const convertMatch = url.pathname.match(/^\/api\/quotes\/([^/]+)\/convert$/);
      if (convertMatch && request.method === "POST") {
        const quote = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?")
          .bind(convertMatch[1]).first();
        if (!quote) return json({ error: "Az árajánlat nem található." }, 404, cors);
        if (quote.status === "converted") return json({ error: "Ez az ajánlat már munkává lett alakítva." }, 409, cors);
        if (quote.status !== "accepted") return json({ error: "Csak elfogadott ajánlat alakítható munkává." }, 400, cors);
        const existingJob = await env.DB.prepare("SELECT id, job_number FROM jobs WHERE quote_id = ?")
          .bind(quote.id).first();
        if (existingJob) return json({ error: "Ehhez az ajánlathoz már tartozik munka.", job: existingJob }, 409, cors);

        const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?")
          .bind(quote.customer_id).first();
        if (!customer) return json({ error: "Az ajánlathoz tartozó ügyfél nem található." }, 400, cors);
        const lead = quote.lead_id
          ? await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(quote.lead_id).first()
          : null;
        const firstItem = await env.DB.prepare("SELECT description FROM quote_items WHERE quote_id = ? ORDER BY sort_order LIMIT 1")
          .bind(quote.id).first();
        const serviceType = ["villanyszereles","klimaszereles","ev_tolto","egyeb"].includes(lead?.service_type)
          ? lead.service_type : "egyeb";
        const jobId = crypto.randomUUID();
        const jobNumber = await generateJobNumber(env.DB);
        const title = firstItem?.description || ("Árajánlat alapján végzendő munka – " + quote.quote_number);
        const description = "Elfogadott árajánlat: " + quote.quote_number +
          (quote.notes ? "\\n" + quote.notes : "");
        const address = lead?.location_text || [customer.postal_code, customer.city, customer.street_address].filter(Boolean).join(" ");
        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO jobs (
              id, customer_id, quote_id, lead_id, job_number, service_type, status,
              title, description, address_text, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(jobId, quote.customer_id, quote.id, quote.lead_id || null, jobNumber,
            serviceType, title, description, address || null, "Automatikusan létrehozva elfogadott árajánlatból."),
          env.DB.prepare("UPDATE quotes SET status = 'converted', updated_at = datetime('now') WHERE id = ?")
            .bind(quote.id)
        ]);
        return json({ success: true, job_id: jobId, job_number: jobNumber }, 201, cors);
      }

      const quoteMatch = url.pathname.match(/^\/api\/quotes\/([^/]+)$/);

      if (quoteMatch && request.method === "GET") {
        const quote = await env.DB.prepare(`
          SELECT quotes.*, customers.name AS customer_name,
                 customers.company_name AS customer_company_name,
                 customers.customer_type, customers.tax_number,
                 customers.email AS customer_email, customers.phone AS customer_phone,
                 customers.postal_code, customers.city, customers.street_address
          FROM quotes LEFT JOIN customers ON customers.id = quotes.customer_id
          WHERE quotes.id = ?
        `).bind(quoteMatch[1]).first();
        if (!quote) return json({ error: "Az árajánlat nem található." }, 404, cors);
        const itemResult = await env.DB.prepare(
          "SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order, rowid"
        ).bind(quoteMatch[1]).all();
        return json({ quote, items: itemResult.results || [], tax_mode: "AAM" }, 200, cors);
      }

      if (quoteMatch && request.method === "PUT") {
        const id = quoteMatch[1];
        const existing = await env.DB.prepare("SELECT * FROM quotes WHERE id = ?").bind(id).first();
        if (!existing) return json({ error: "Az árajánlat nem található." }, 404, cors);
        const data = await readBody(request) || {};
        const allowed = ["draft", "sent", "accepted", "rejected", "expired", "converted"];
        const updates = [], values = [];
        if (data.status !== undefined) {
          if (!allowed.includes(data.status)) return json({ error: "Érvénytelen ajánlati státusz." }, 400, cors);
          if (existing.status === "converted" && data.status !== "converted") {
            return json({ error: "A munkává alakított ajánlat státusza nem módosítható." }, 400, cors);
          }
          updates.push("status = ?"); values.push(data.status);
        }
        if (data.valid_until !== undefined) {
          if (data.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(data.valid_until)) {
            return json({ error: "Érvénytelen érvényességi dátum." }, 400, cors);
          }
          updates.push("valid_until = ?"); values.push(data.valid_until || null);
        }
        if (data.notes !== undefined) {
          updates.push("notes = ?"); values.push(data.notes === null ? null : String(data.notes).slice(0, 5000));
        }
        if (data.issue_date !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(data.issue_date || "")) return json({ error: "Érvénytelen kiállítási dátum." }, 400, cors);
          updates.push("issue_date = ?"); values.push(data.issue_date);
        }
        if (data.customer_id !== undefined) {
          const customer = await env.DB.prepare("SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL").bind(data.customer_id).first();
          if (!customer) return json({ error: "Az ügyfél nem található." }, 400, cors);
          updates.push("customer_id = ?"); values.push(data.customer_id);
        }
        let normalizedItems = null;
        if (data.items !== undefined) {
          try { normalizedItems = normalizeQuoteItems(data.items); }
          catch (error) { return json({ error: error.message }, 400, cors); }
          const newTotal = normalizedItems.reduce((sum, item) => sum + item.line_net, 0);
          if (!Number.isSafeInteger(newTotal)) return json({ error: "Az ajánlat végösszege túl nagy." }, 400, cors);
          updates.push("net_total = ?"); values.push(newTotal);
          updates.push("vat_total = 0");
          updates.push("gross_total = ?"); values.push(newTotal);
        }
        if (!updates.length && !normalizedItems) return json({ error: "Nincs módosítandó adat." }, 400, cors);
        updates.push("updated_at = datetime('now')");
        const statements = [];
        if (updates.length) statements.push(env.DB.prepare(`UPDATE quotes SET ${updates.join(", ")} WHERE id = ?`).bind(...values, id));
        if (normalizedItems) {
          statements.push(env.DB.prepare("DELETE FROM quote_items WHERE quote_id = ?").bind(id));
          for (const item of normalizedItems) {
            statements.push(env.DB.prepare(`
              INSERT INTO quote_items (
                id, quote_id, sort_order, item_type, description, quantity, unit,
                unit_net_price, vat_rate, line_net, line_vat, line_gross
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?)
            `).bind(item.id, id, item.sort_order, item.item_type, item.description,
              item.quantity, item.unit, item.unit_net_price, item.line_net, item.line_gross));
          }
        }
        await env.DB.batch(statements);
        return json({ success: true, id }, 200, cors);
      }

      // Ügyfelek listázása
      if (url.pathname === "/api/customers" && request.method === "GET") {
        const q = (url.searchParams.get("q") || "").trim();

        let result;

        if (q) {
          result = await env.DB.prepare(
            `SELECT * FROM customers
             WHERE deleted_at IS NULL
             AND (
               name LIKE ? OR
               company_name LIKE ? OR
               phone LIKE ? OR
               email LIKE ?
             )
             ORDER BY created_at DESC
             LIMIT 200`
          )
            .bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
            .all();
        } else {
          result = await env.DB.prepare(
            `SELECT * FROM customers
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT 200`
          ).all();
        }

        const items = result.results || [];

        return json({
          items,
          customers: items
        }, 200, cors);
      }

      // Új ügyfél mentése
      if (url.pathname === "/api/customers" && request.method === "POST") {
        const data = cleanFields(
          await readBody(request),
          CUSTOMER_FIELDS
        );

        if (!data.name || !String(data.name).trim()) {
          return json(
            { error: "Az ügyfél neve kötelező." },
            400,
            cors
          );
        }

        if (!data.customer_type) data.customer_type = "person";
        if (data.customer_type === "private") {
          data.customer_type = "person";
        }

        const id = crypto.randomUUID();
        const keys = ["id", ...Object.keys(data)];
        const values = [id, ...Object.keys(data).map(k => data[k])];

        await env.DB.prepare(
          `INSERT INTO customers (
            ${keys.join(",")},
            created_at,
            updated_at
          )
          VALUES (
            ${placeholders(keys.length)},
            datetime('now'),
            datetime('now')
          )`
        )
          .bind(...values)
          .run();

        return json({ success: true, id }, 201, cors);
      }

      const customerMatch = url.pathname.match(
        /^\/api\/customers\/([^/]+)$/
      );

      // Ügyfél módosítása
      if (customerMatch && request.method === "PUT") {
        const id = customerMatch[1];
        const data = cleanFields(
          await readBody(request),
          CUSTOMER_FIELDS
        );

        if (!data.customer_type) {
          const existing = await env.DB.prepare(
            "SELECT customer_type FROM customers WHERE id = ? AND deleted_at IS NULL"
          ).bind(id).first();

          if (!existing) {
            return json(
              { error: "Az ügyfél nem található." },
              404,
              cors
            );
          }

          data.customer_type = existing.customer_type;
        }

        if (data.customer_type === "private") {
          data.customer_type = "person";
        }

        const keys = Object.keys(data);

        if (!keys.length) {
          return json(
            { error: "Nincs módosítandó adat." },
            400,
            cors
          );
        }

        const result = await env.DB.prepare(
          `UPDATE customers
           SET ${keys.map(k => `${k} = ?`).join(", ")},
           updated_at = datetime('now')
           WHERE id = ? AND deleted_at IS NULL`
        )
          .bind(...keys.map(k => data[k]), id)
          .run();

        return json({
          success: true,
          changes: result.meta.changes
        }, 200, cors);
      }

      // Ügyfél törlése (soft delete)
      if (customerMatch && request.method === "DELETE") {
        const id = customerMatch[1];

        const result = await env.DB.prepare(
          `UPDATE customers
           SET deleted_at = datetime('now'),
               updated_at = datetime('now')
           WHERE id = ? AND deleted_at IS NULL`
        )
          .bind(id)
          .run();

        return json({
          success: true,
          changes: result.meta.changes
        }, 200, cors);
      }

      // Érdeklődők listázása
      if (url.pathname === "/api/leads" && request.method === "GET") {
        const result = await env.DB.prepare(
          `SELECT
             leads.*,
             customers.name AS customer_name,
             customers.phone AS customer_phone,
             customers.email AS customer_email
           FROM leads
           LEFT JOIN customers ON customers.id = leads.customer_id
           ORDER BY leads.created_at DESC
           LIMIT 300`
        ).all();

        const items = result.results || [];

        return json({
          items,
          leads: items
        }, 200, cors);
      }
// Meglévő érdeklődés módosítása
const leadMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);

if (leadMatch && request.method === "PUT") {
  const id = leadMatch[1];

  const existing = await env.DB.prepare(
    "SELECT id FROM leads WHERE id = ?"
  ).bind(id).first();

  if (!existing) {
    return json({ error: "Az érdeklődő nem található." }, 404, cors);
  }

  const data = cleanFields(await readBody(request), LEAD_FIELDS);

  if ("subject" in data && (!data.subject || !String(data.subject).trim())) {
    return json({ error: "A tárgy megadása kötelező." }, 400, cors);
  }

  const allowedServices = ["villanyszereles", "klimaszereles", "ev_tolto", "egyeb"];
  const allowedSources = ["website", "phone", "email", "facebook", "referral", "manual"];
  const allowedStatuses = ["new", "contacted", "survey", "quoted", "won", "lost", "archived"];

  if (data.service_type && !allowedServices.includes(data.service_type)) {
    return json({ error: "Érvénytelen szolgáltatástípus." }, 400, cors);
  }

  if (data.source && !allowedSources.includes(data.source)) {
    return json({ error: "Érvénytelen forrás." }, 400, cors);
  }

  if (data.status && !allowedStatuses.includes(data.status)) {
    return json({ error: "Érvénytelen státusz." }, 400, cors);
  }

  const keys = Object.keys(data);

  if (!keys.length) {
    return json({ error: "Nincs módosítandó adat." }, 400, cors);
  }

  const result = await env.DB.prepare(
    `UPDATE leads SET ${keys.map(key => `${key} = ?`).join(", ")},
     updated_at = datetime('now')
     WHERE id = ?`
  ).bind(...keys.map(key => data[key]), id).run();

  return json({ success: true, changes: result.meta.changes }, 200, cors);
}

 // Érdeklődő törlése
if (leadMatch && request.method === "DELETE") {
  const id = leadMatch[1];

  const existing = await env.DB.prepare(
    "SELECT id FROM leads WHERE id = ?"
  ).bind(id).first();

  if (!existing) {
    return json({ error: "Az érdeklődő nem található." }, 404, cors);
  }

  await env.DB.prepare(
    "DELETE FROM leads WHERE id = ?"
  ).bind(id).run();

  return json({
    success: true,
    message: "Az érdeklődő sikeresen törölve."
  }, 200, cors);
}
 
// Munkák listázása
if (url.pathname === "/api/jobs" && request.method === "GET") {
  const result = await env.DB.prepare(
    `SELECT
       jobs.*,
       customers.name AS customer_name,
       customers.phone AS customer_phone,
       customers.email AS customer_email
     FROM jobs
     LEFT JOIN customers ON customers.id = jobs.customer_id
     ORDER BY jobs.created_at DESC
     LIMIT 300`
  ).all();

  const items = result.results || [];

  return json({
    items,
    jobs: items
  }, 200, cors);
}

// Új munka mentése
if (url.pathname === "/api/jobs" && request.method === "POST") {
  const data = cleanFields(
    await readBody(request),
    JOB_FIELDS
  );

  if (!data.customer_id) {
    return json(
      { error: "Az ügyfél kiválasztása kötelező." },
      400,
      cors
    );
  }

  if (!data.title || !String(data.title).trim()) {
    return json(
      { error: "A munka megnevezése kötelező." },
      400,
      cors
    );
  }

  const customer = await env.DB.prepare(
    "SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL"
  ).bind(data.customer_id).first();

  if (!customer) {
    return json(
      { error: "A kiválasztott ügyfél nem található." },
      400,
      cors
    );
  }

  if (data.lead_id) {
    const lead = await env.DB.prepare(
      "SELECT id, customer_id FROM leads WHERE id = ?"
    ).bind(data.lead_id).first();

    if (!lead) {
      return json(
        { error: "A kapcsolódó érdeklődés nem található." },
        400,
        cors
      );
    }

    if (lead.customer_id && lead.customer_id !== data.customer_id) {
      return json(
        { error: "Az érdeklődés másik ügyfélhez tartozik." },
        400,
        cors
      );
    }
  }

  const allowedServices = [
    "villanyszereles",
    "klimaszereles",
    "ev_tolto",
    "egyeb"
  ];

  const allowedStatuses = [
    "planned",
    "in_progress",
    "waiting_material",
    "completed",
    "cancelled"
  ];

  if (!allowedServices.includes(data.service_type)) {
    return json(
      { error: "Érvénytelen szolgáltatástípus." },
      400,
      cors
    );
  }

  if (!data.status) data.status = "planned";

  if (!allowedStatuses.includes(data.status)) {
    return json(
      { error: "Érvénytelen munkastátusz." },
      400,
      cors
    );
  }

  const laborMinutes = Number(data.labor_minutes ?? 0);

  if (!Number.isInteger(laborMinutes) || laborMinutes < 0) {
    return json(
      { error: "A munkaidő csak nulla vagy pozitív egész szám lehet." },
      400,
      cors
    );
  }

  data.labor_minutes = laborMinutes;

  const id = crypto.randomUUID();
  const jobNumber = await generateJobNumber(env.DB);

  const keys = ["id", "job_number", ...Object.keys(data)];
  const values = [
    id,
    jobNumber,
    ...Object.keys(data).map(key => data[key])
  ];

  await env.DB.prepare(
    `INSERT INTO jobs (
      ${keys.join(",")},
      completed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${placeholders(keys.length)},
      ${data.status === "completed" ? "datetime('now')" : "NULL"},
      datetime('now'),
      datetime('now')
    )`
  )
    .bind(...values)
    .run();

  return json({
    success: true,
    id,
    job_number: jobNumber
  }, 201, cors);
}

// Meglévő munka módosítása
const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);

if (jobMatch && request.method === "PUT") {
  const id = jobMatch[1];

  const existing = await env.DB.prepare(
    "SELECT * FROM jobs WHERE id = ?"
  ).bind(id).first();

  if (!existing) {
    return json(
      { error: "A munka nem található." },
      404,
      cors
    );
  }

  const data = cleanFields(
    await readBody(request),
    JOB_FIELDS
  );

  if (Object.keys(data).length === 0) {
    return json(
      { error: "Nincs módosítandó adat." },
      400,
      cors
    );
  }

  const customerId = data.customer_id ?? existing.customer_id;
  const leadId = data.lead_id ?? existing.lead_id;

  const customer = await env.DB.prepare(
    "SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL"
  ).bind(customerId).first();

  if (!customer) {
    return json(
      { error: "A kiválasztott ügyfél nem található." },
      400,
      cors
    );
  }

  if (leadId) {
    const lead = await env.DB.prepare(
      "SELECT id, customer_id FROM leads WHERE id = ?"
    ).bind(leadId).first();

    if (!lead) {
      return json(
        { error: "A kapcsolódó érdeklődés nem található." },
        400,
        cors
      );
    }

    if (lead.customer_id && lead.customer_id !== customerId) {
      return json(
        { error: "Az érdeklődés másik ügyfélhez tartozik." },
        400,
        cors
      );
    }
  }

  const allowedServices = [
    "villanyszereles",
    "klimaszereles",
    "ev_tolto",
    "egyeb"
  ];

  const allowedStatuses = [
    "planned",
    "in_progress",
    "waiting_material",
    "completed",
    "cancelled"
  ];

  if (
    data.service_type &&
    !allowedServices.includes(data.service_type)
  ) {
    return json(
      { error: "Érvénytelen szolgáltatástípus." },
      400,
      cors
    );
  }

  if (
    data.status &&
    !allowedStatuses.includes(data.status)
  ) {
    return json(
      { error: "Érvénytelen munkastátusz." },
      400,
      cors
    );
  }

  if (
    data.title !== undefined &&
    !String(data.title || "").trim()
  ) {
    return json(
      { error: "A munka megnevezése kötelező." },
      400,
      cors
    );
  }

  if (data.labor_minutes !== undefined) {
    const minutes = Number(data.labor_minutes);

    if (!Number.isInteger(minutes) || minutes < 0) {
      return json(
        { error: "Érvénytelen munkaidő." },
        400,
        cors
      );
    }

    data.labor_minutes = minutes;
  }

  const fields = Object.keys(data);

  const setClause = fields
    .map(field => `${field} = ?`)
    .join(", ");

  const values = fields.map(field => data[field]);

  const updates = [setClause];

  if (data.status === "completed") {
    updates.push(
      "completed_at = COALESCE(completed_at, datetime('now'))"
    );
  } else if (data.status) {
    updates.push("completed_at = NULL");
  }

  updates.push("updated_at = datetime('now')");

  await env.DB.prepare(
    `UPDATE jobs
     SET ${updates.join(", ")}
     WHERE id = ?`
  ).bind(...values, id).run();

  return json({
    success: true,
    id
  }, 200, cors);
}

// Munka törlése
if (jobMatch && request.method === "DELETE") {
  const result = await env.DB.prepare(
    "DELETE FROM jobs WHERE id = ?"
  ).bind(jobMatch[1]).run();

  if (!result.meta?.changes) {
    return json(
      { error: "A munka nem található." },
      404,
      cors
    );
  }

  return json({
    success: true
  }, 200, cors);
}

      // Új érdeklődés mentése
      if (url.pathname === "/api/leads" && request.method === "POST") {
        const data = cleanFields(
          await readBody(request),
          LEAD_FIELDS
        );

        if (!data.subject || !String(data.subject).trim()) {
          return json(
            { error: "Az érdeklődés tárgya kötelező." },
            400,
            cors
          );
        }

        const allowedServices = [
          "villanyszereles",
          "klimaszereles",
          "ev_tolto",
          "egyeb"
        ];

        const allowedSources = [
          "website",
          "phone",
          "email",
          "facebook",
          "referral",
          "manual"
        ];

        const allowedStatuses = [
          "new",
          "contacted",
          "survey",
          "quoted",
          "won",
          "lost",
          "archived"
        ];

        if (!allowedServices.includes(data.service_type)) {
          return json(
            { error: "Érvénytelen szolgáltatástípus." },
            400,
            cors
          );
        }

        if (!data.source) data.source = "manual";
        if (!data.status) data.status = "new";

        if (!allowedSources.includes(data.source)) {
          return json(
            { error: "Érvénytelen érdeklődési forrás." },
            400,
            cors
          );
        }

        if (!allowedStatuses.includes(data.status)) {
          return json(
            { error: "Érvénytelen érdeklődési állapot." },
            400,
            cors
          );
        }

        const id = crypto.randomUUID();
        const keys = ["id", ...Object.keys(data)];
        const values = [id, ...Object.keys(data).map(k => data[k])];

        await env.DB.prepare(
          `INSERT INTO leads (
            ${keys.join(",")},
            created_at,
            updated_at
          )
          VALUES (
            ${placeholders(keys.length)},
            datetime('now'),
            datetime('now')
          )`
        )
          .bind(...values)
          .run();

        return json({ success: true, id }, 201, cors);
      }


      // Munkánkénti nyereségességi áttekintő
      if (url.pathname === "/api/profitability" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT
            jobs.id, jobs.job_number, jobs.title, jobs.status, jobs.created_at,
            customers.name AS customer_name,
            quotes.quote_number, COALESCE(quotes.gross_total,0) AS offer_amount,
            COALESCE((SELECT SUM(gross_amount) FROM income_records WHERE job_id=jobs.id),0) AS invoiced_amount,
            COALESCE((SELECT SUM(gross_amount) FROM income_records WHERE job_id=jobs.id AND paid=1),0) AS received_amount,
            COALESCE((SELECT SUM(gross_amount) FROM income_records WHERE job_id=jobs.id AND paid=0),0) AS receivable_amount,
            COALESCE((SELECT SUM(ROUND(quantity*unit_net_cost)) FROM job_cost_items WHERE job_id=jobs.id AND cost_type='material'),0) AS material_cost,
            COALESCE((SELECT SUM(ROUND(quantity*unit_net_cost)) FROM job_cost_items WHERE job_id=jobs.id AND cost_type='labor'),0) AS labor_cost,
            COALESCE((SELECT SUM(ROUND(quantity*unit_net_cost)) FROM job_cost_items WHERE job_id=jobs.id AND cost_type IN ('travel','other')),0) AS other_direct_cost,
            COALESCE((SELECT SUM(gross_amount) FROM expenses WHERE job_id=jobs.id),0) AS linked_expenses,
            COALESCE((SELECT SUM(gross_amount) FROM expenses WHERE job_id=jobs.id AND paid=1),0) AS paid_linked_expenses
          FROM jobs
          LEFT JOIN customers ON customers.id=jobs.customer_id
          LEFT JOIN quotes ON quotes.id=jobs.quote_id
          WHERE jobs.status <> 'cancelled'
          ORDER BY jobs.created_at DESC LIMIT 300
        `).all();
        const items=(result.results||[]).map(row=>{
          const costs=Number(row.material_cost||0)+Number(row.labor_cost||0)+Number(row.other_direct_cost||0)+Number(row.linked_expenses||0);
          const invoiced=Number(row.invoiced_amount||0);
          const received=Number(row.received_amount||0), paidExpenses=Number(row.paid_linked_expenses||0);
          return {...row,total_cost:costs,invoiced_result:invoiced-costs,cashflow_result:received-paidExpenses,balance_due:Math.max(0,invoiced-received),offer_margin:row.offer_amount?Number(row.offer_amount)-costs:null};
        });
        return json({items,tax_mode:"AAM"},200,cors);
      }

      // Munkalap: költségek és pénzügyi összesítő
      const jobCostsMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/costs$/);
      if (jobCostsMatch && request.method === "GET") {
        const jobId = jobCostsMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const costs = await env.DB.prepare("SELECT * FROM job_cost_items WHERE job_id = ? ORDER BY created_at DESC").bind(jobId).all();
        const income = await env.DB.prepare("SELECT COALESCE(SUM(gross_amount),0) AS total FROM income_records WHERE job_id = ?").bind(jobId).first();
        const expenses = await env.DB.prepare("SELECT COALESCE(SUM(gross_amount),0) AS total FROM expenses WHERE job_id = ?").bind(jobId).first();
        const directCost = (costs.results || []).reduce((sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unit_net_cost || 0)), 0);
        const otherExpenses = Number(expenses?.total || 0);
        const incomeTotal = Number(income?.total || 0);
        return json({ items: costs.results || [], totals: { direct_cost: directCost, other_expenses: otherExpenses, total_cost: directCost + otherExpenses, income: incomeTotal, result: incomeTotal - directCost - otherExpenses }, tax_mode: "AAM" }, 200, cors);
      }

      if (jobCostsMatch && request.method === "POST") {
        const jobId = jobCostsMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const data = await readBody(request) || {};
        const allowedTypes = ["material", "labor", "travel", "other"];
        const costType = data.cost_type || "material";
        const description = String(data.description || "").trim().slice(0, 500);
        const quantity = Number(data.quantity ?? 1);
        const unitCost = Number(data.unit_net_cost ?? 0);
        if (!allowedTypes.includes(costType)) return json({ error: "Érvénytelen költségtípus." }, 400, cors);
        if (!description) return json({ error: "A megnevezés kötelező." }, 400, cors);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) return json({ error: "Érvénytelen mennyiség." }, 400, cors);
        if (!Number.isSafeInteger(unitCost) || unitCost < 0) return json({ error: "Az egységköltség nulla vagy pozitív egész forint lehet." }, 400, cors);
        const unit = String(data.unit || "db").trim().slice(0, 30) || "db";
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO job_cost_items (id, job_id, cost_type, description, quantity, unit, unit_net_cost, vat_rate) VALUES (?, ?, ?, ?, ?, ?, ?, 0)")
          .bind(id, jobId, costType, description, quantity, unit, unitCost).run();
        return json({ success: true, id, line_total: Math.round(quantity * unitCost), tax_mode: "AAM" }, 201, cors);
      }

      const jobCostItemMatch = url.pathname.match(/^\/api\/job-cost-items\/([^/]+)$/);
      if (jobCostItemMatch && request.method === "DELETE") {
        const result = await env.DB.prepare("DELETE FROM job_cost_items WHERE id = ?").bind(jobCostItemMatch[1]).run();
        if (!result.meta?.changes) return json({ error: "A költségtétel nem található." }, 404, cors);
        return json({ success: true }, 200, cors);
      }


      // Munkához kapcsolódó bevételek / számlák
      const jobIncomeMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/income$/);
      if (jobIncomeMatch && request.method === "GET") {
        const jobId = jobIncomeMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const result = await env.DB.prepare("SELECT * FROM income_records WHERE job_id = ? ORDER BY income_date DESC, created_at DESC").bind(jobId).all();
        return json({ items: result.results || [], tax_mode: "AAM" }, 200, cors);
      }

      if (jobIncomeMatch && request.method === "POST") {
        const jobId = jobIncomeMatch[1];
        const job = await env.DB.prepare("SELECT id, customer_id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const data = await readBody(request) || {};
        const description = String(data.description || "").trim().slice(0, 500);
        const invoiceNumber = String(data.invoice_number || "").trim().slice(0, 100) || null;
        const incomeDate = String(data.income_date || "").trim();
        const amount = Number(data.gross_amount);
        if (!description) return json({ error: "A bevétel megnevezése kötelező." }, 400, cors);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(incomeDate)) return json({ error: "Érvényes dátum szükséges." }, 400, cors);
        if (!Number.isSafeInteger(amount) || amount <= 0) return json({ error: "Az összeg pozitív egész forint legyen." }, 400, cors);
        const id = crypto.randomUUID();
        const paid = data.paid ? 1 : 0;
        const paidDate = paid ? String(data.paid_date || "").trim() : null;
        if (paid && !/^\d{4}-\d{2}-\d{2}$/.test(paidDate || "")) return json({ error: "Fizetett bevételnél a tényleges fizetési dátum kötelező." }, 400, cors);
        await env.DB.prepare("INSERT INTO income_records (id, job_id, customer_id, income_date, description, net_amount, vat_amount, gross_amount, invoice_number, paid, paid_date) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)")
          .bind(id, jobId, job.customer_id, incomeDate, description, amount, amount, invoiceNumber, paid, paidDate).run();
        return json({ success: true, id, tax_mode: "AAM" }, 201, cors);
      }

      const incomeRecordMatch = url.pathname.match(/^\/api\/income-records\/([^/]+)$/);
      if (incomeRecordMatch && request.method === "PUT") {
        const data = await readBody(request) || {};
        const existing = await env.DB.prepare("SELECT id FROM income_records WHERE id = ?").bind(incomeRecordMatch[1]).first();
        if (!existing) return json({ error: "A bevételi tétel nem található." }, 404, cors);
        const invoiceNumber = String(data.invoice_number || "").trim().slice(0, 100) || null;
        const paid = data.paid ? 1 : 0;
        const paidDate = paid ? String(data.paid_date || "").trim() : null;
        if (paid && !/^\d{4}-\d{2}-\d{2}$/.test(paidDate || "")) return json({ error: "Fizetett bevételnél a tényleges fizetési dátum kötelező." }, 400, cors);
        await env.DB.prepare("UPDATE income_records SET invoice_number = ?, paid = ?, paid_date = ? WHERE id = ?")
          .bind(invoiceNumber, paid, paidDate, incomeRecordMatch[1]).run();
        return json({ success: true }, 200, cors);
      }

      if (incomeRecordMatch && request.method === "DELETE") {
        const result = await env.DB.prepare("DELETE FROM income_records WHERE id = ?").bind(incomeRecordMatch[1]).run();
        if (!result.meta?.changes) return json({ error: "A bevételi tétel nem található." }, 404, cors);
        return json({ success: true }, 200, cors);
      }


      // Részletes munkanapló
      const workLogsMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/work-logs$/);
      if (workLogsMatch && request.method === "GET") {
        const jobId = workLogsMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const result = await env.DB.prepare("SELECT * FROM work_logs WHERE job_id = ? ORDER BY work_date DESC, created_at DESC").bind(jobId).all();
        const logs = result.results || [];
        return json({ items: logs, total_minutes: logs.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0) }, 200, cors);
      }

      if (workLogsMatch && request.method === "POST") {
        const jobId = workLogsMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const data = await readBody(request) || {};
        const workDate = String(data.work_date || "").trim();
        const task = String(data.task_description || "").trim().slice(0, 1000);
        const startTime = String(data.start_time || "").trim() || null;
        const endTime = String(data.end_time || "").trim() || null;
        const duration = Number(data.duration_minutes ?? 0);
        const notes = String(data.notes || "").trim().slice(0, 2000) || null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return json({ error: "Érvényes munkanap szükséges." }, 400, cors);
        if (!task) return json({ error: "Az elvégzett feladat megnevezése kötelező." }, 400, cors);
        if (!Number.isSafeInteger(duration) || duration < 0 || duration > 1440) return json({ error: "A munkaidő 0 és 1440 perc közötti egész szám lehet." }, 400, cors);
        if ((startTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) || (endTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime))) return json({ error: "Az időpont formátuma ÓÓ:PP legyen." }, 400, cors);
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO work_logs (id, job_id, work_date, start_time, end_time, duration_minutes, task_description, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, jobId, workDate, startTime, endTime, duration, task, notes).run();
        return json({ success: true, id }, 201, cors);
      }

      const workLogMatch = url.pathname.match(/^\/api\/work-logs\/([^/]+)$/);
      if (workLogMatch && request.method === "DELETE") {
        const result = await env.DB.prepare("DELETE FROM work_logs WHERE id = ?").bind(workLogMatch[1]).run();
        if (!result.meta?.changes) return json({ error: "A munkanapló-bejegyzés nem található." }, 404, cors);
        return json({ success: true }, 200, cors);
      }


      // Munkához csatolt fájlok – privát R2 tárolás
      const jobAttachmentsMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/attachments$/);
      if (jobAttachmentsMatch && request.method === "GET") {
        const jobId = jobAttachmentsMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const result = await env.DB.prepare(
          "SELECT id, job_id, file_name, content_type, file_size, created_at FROM attachments WHERE job_id = ? ORDER BY created_at DESC"
        ).bind(jobId).all();
        return json({ items: result.results || [] }, 200, cors);
      }

      if (jobAttachmentsMatch && request.method === "POST") {
        if (!env.FILES) return json({ error: "A fájltároló nincs konfigurálva." }, 500, cors);
        const jobId = jobAttachmentsMatch[1];
        const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ?").bind(jobId).first();
        if (!job) return json({ error: "A munka nem található." }, 404, cors);
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || !file.size) return json({ error: "Válassz ki egy fájlt." }, 400, cors);
        if (file.size > 10 * 1024 * 1024) return json({ error: "A fájl legfeljebb 10 MB lehet." }, 400, cors);
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(file.type)) return json({ error: "Csak JPG, PNG, WebP vagy PDF fájl tölthető fel." }, 400, cors);

        // Valódi fájltípus ellenőrzése a tartalom alapján, nem csak a böngésző MIME-adatából.
        const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        const startsWith = (...bytes) => bytes.every((value, index) => signature[index] === value);
        let verifiedType = null;
        if (startsWith(0xFF, 0xD8, 0xFF)) verifiedType = "image/jpeg";
        else if (startsWith(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) verifiedType = "image/png";
        else if (startsWith(0x52, 0x49, 0x46, 0x46) && signature[8] === 0x57 && signature[9] === 0x45 && signature[10] === 0x42 && signature[11] === 0x50) verifiedType = "image/webp";
        else if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2D)) verifiedType = "application/pdf";
        if (!verifiedType || verifiedType !== file.type) {
          return json({ error: "A fájl tartalma nem egyezik a kiválasztott fájltípussal. Kérlek, valódi JPG, PNG, WebP vagy PDF fájlt válassz." }, 400, cors);
        }
        const safeName = String(file.name || "csatolmany").replace(/[\\/\r\n\0]/g, "_").slice(0, 180);
        const id = crypto.randomUUID();
        const key = "jobs/" + jobId + "/" + id;
        await env.FILES.put(key, file.stream(), {
          httpMetadata: { contentType: verifiedType },
          customMetadata: { originalName: safeName }
        });
        try {
          await env.DB.prepare(
            "INSERT INTO attachments (id, job_id, object_key, file_name, content_type, file_size, visibility) VALUES (?, ?, ?, ?, ?, ?, 'private')"
          ).bind(id, jobId, key, safeName, verifiedType, file.size).run();
        } catch (error) {
          await env.FILES.delete(key);
          throw error;
        }
        return json({ success: true, id, file_name: safeName }, 201, cors);
      }

      const attachmentMatch = url.pathname.match(/^\/api\/attachments\/([^/]+)$/);
      if (attachmentMatch && request.method === "GET") {
        if (!env.FILES) return json({ error: "A fájltároló nincs konfigurálva." }, 500, cors);
        const attachment = await env.DB.prepare("SELECT * FROM attachments WHERE id = ?")
          .bind(attachmentMatch[1]).first();
        if (!attachment || !attachment.job_id) return json({ error: "A csatolmány nem található." }, 404, cors);
        const object = await env.FILES.get(attachment.object_key);
        if (!object) return json({ error: "A fájl nem található a tárhelyen." }, 404, cors);
        const safeName = attachment.file_name.replace(/["\\\r\n]/g, "_");
        return new Response(object.body, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": attachment.content_type,
            "Content-Length": String(attachment.file_size),
            "Content-Disposition": (url.searchParams.get("inline") === "1" && attachment.content_type.startsWith("image/") ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(safeName),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      if (attachmentMatch && request.method === "DELETE") {
        if (!env.FILES) return json({ error: "A fájltároló nincs konfigurálva." }, 500, cors);
        const attachment = await env.DB.prepare("SELECT id, object_key FROM attachments WHERE id = ?")
          .bind(attachmentMatch[1]).first();
        if (!attachment) return json({ error: "A csatolmány nem található." }, 404, cors);
        await env.FILES.delete(attachment.object_key);
        await env.DB.prepare("DELETE FROM attachments WHERE id = ?").bind(attachment.id).run();
        return json({ success: true }, 200, cors);
      }

      return json(
        { error: "Ismeretlen végpont." },
        404,
        cors
      );

    } catch (error) {
      console.error("CRM API error:", error);

      return json(
        {
          error: "Adatbázis-műveleti hiba. Ellenőrizd a Worker naplóit.",
          details: error?.message || String(error)
        },
        500,
        cors
      );
    }
  }
};
