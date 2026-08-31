export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      to, studentFirst, studentLast,
      accessCode, teacherName, schoolName,
      period, grade
    } = req.body;

    const RESEND_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_KEY) {
      return res.status(500).json({
        error: "RESEND_API_KEY not set. Go to Vercel → Project → Settings → Environment Variables and add it."
      });
    }

    if (!to || !accessCode) {
      return res.status(400).json({ error: "Missing: to, accessCode" });
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:2rem auto;background:#09122B;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.3)">

    <div style="background:linear-gradient(135deg,#0D1B3E 0%,#162248 100%);padding:2rem;text-align:center;border-bottom:1px solid rgba(201,168,76,0.3)">
      <div style="font-size:36px;margin-bottom:8px">&#127942;</div>
      <div style="font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:.08em;font-family:Georgia,serif">VIKINGSTRONG</div>
      <div style="font-size:13px;color:#A8B4CC;margin-top:6px">${schoolName || "Physical Education"}</div>
    </div>

    <div style="padding:2rem">
      <p style="color:#F0E6C8;font-size:16px;margin:0 0 1rem 0">Hi <strong>${studentFirst || "Student"}</strong>,</p>
      <p style="color:#A8B4CC;font-size:14px;line-height:1.7;margin:0 0 1.5rem 0">
        Your teacher has set up VikingStrong to help you track your fitness improvements week by week.
        Use the code below every time you want to log your scores.
      </p>

      <div style="background:#1E2F5A;border:2px solid #C9A84C;border-radius:12px;padding:1.75rem;text-align:center;margin:0 0 1.5rem 0">
        <div style="font-size:11px;color:#A8B4CC;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px">Your Personal Access Code</div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:700;color:#C9A84C;letter-spacing:.18em">${accessCode}</div>
        <div style="font-size:11px;color:#6B7A99;margin-top:10px">Keep this private — it's your key to your personal scores</div>
      </div>

      <div style="background:#162248;border-radius:10px;padding:1.25rem;margin:0 0 1.5rem 0">
        <div style="font-size:12px;color:#C9A84C;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px">How to log your scores</div>
        ${[
          "Scan your teacher's QR code in the gym — or visit the class link they shared",
          "Find your name in the student list",
          "Enter your access code above to confirm it's you",
          "Enter your scores for each activity and tap Save"
        ].map((step, i) => `
        <div style="display:table;width:100%;margin-bottom:10px">
          <div style="display:table-cell;width:28px;vertical-align:top">
            <div style="background:#C9A84C;color:#09122B;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:700">${i + 1}</div>
          </div>
          <div style="display:table-cell;color:#A8B4CC;font-size:13px;line-height:1.6;padding-left:8px">${step}</div>
        </div>`).join("")}
      </div>

      <div style="border-top:1px solid rgba(201,168,76,0.2);padding-top:1rem">
        <table style="font-size:12px;color:#6B7A99;border-collapse:collapse">
          <tr>
            <td style="padding:3px 16px 3px 0">Student</td>
            <td style="color:#A8B4CC;font-weight:500">${studentFirst} ${studentLast || ""}</td>
          </tr>
          ${grade ? `<tr><td style="padding:3px 16px 3px 0">Grade</td><td style="color:#A8B4CC;font-weight:500">${grade}</td></tr>` : ""}
          ${period ? `<tr><td style="padding:3px 16px 3px 0">Period</td><td style="color:#A8B4CC;font-weight:500">${period}</td></tr>` : ""}
        </table>
      </div>
    </div>

    <div style="background:#0D1B3E;padding:1.25rem 2rem;text-align:center;border-top:1px solid rgba(201,168,76,0.15)">
      <div style="font-size:12px;color:#6B7A99">
        Sent by <span style="color:#A8B4CC">${teacherName || "Your PE Teacher"}</span>
        ${schoolName ? ` &middot; <span style="color:#A8B4CC">${schoolName}</span>` : ""}
      </div>
    </div>

  </div>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "VikingStrong <onboarding@resend.dev>",
        to: [to],
        subject: `Your VikingStrong Access Code: ${accessCode}`,
        html: emailHtml
      })
    });

    const data = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", data);
      return res.status(resendRes.status).json({
        error: data.message || "Resend API error",
        details: data
      });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
