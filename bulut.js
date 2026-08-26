/* ============================================================
   INTIZOM — Bulut sinxron + Email KOD (OTP) bilan kirish
   Ilova kodiga tegmaydi. Ustidan ishlaydi.
     1) Birinchi kirish: email -> 6 xonali kod -> ichkariga
     2) Keyin xohlasa: sozlamalardan parol qo'yadi (parol bilan tez kiradi)
     - kirgach: serverdan ma'lumot -> localStorage -> render
     - har o'zgarishda: localStorage -> serverga saqlash (debounce)
   ============================================================ */
(function () {
  "use strict";

  var SUPA_URL = "https://kqtonpusgorwfqktbeto.supabase.co";
  var SUPA_KEY = "sb_publishable_bclhi6PMaXkdYB5JvpqCIQ_YpB5GJGN";
  var TABLE = "intizom_data";

  // ---- localStorage kalitlarini yig'ish ----
  function collect() {
    var skip = { i_pin_session: 1, i_parol_ok: 1 };
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("i_") === 0 && !skip[k]) data[k] = localStorage.getItem(k);
    }
    return data;
  }
  function apply(data) {
    if (!data) return;
    Object.keys(data).forEach(function (k) {
      try { localStorage.setItem(k, data[k]); } catch (e) {}
    });
  }

  function loadSb() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = res;
      s.onerror = function () { rej(new Error("Supabase kutubxonasi yuklanmadi")); };
      document.head.appendChild(s);
    });
  }

  var sb = null, uid = null, saveTimer = null, pulling = false;

  function pushNow() {
    if (!sb || !uid || pulling) return;
    var row = { user_id: uid, data: collect(), updated_at: new Date().toISOString() };
    sb.from(TABLE).upsert(row, { onConflict: "user_id" }).then(function (r) {
      var dot = document.getElementById("bulut-dot");
      if (dot) dot.style.background = r.error ? "#EF4444" : "#10B981";
    });
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(pushNow, 1200); }

  function hookStorage() {
    var _set = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      _set(k, v);
      if (k && k.indexOf("i_") === 0 && k !== "i_pin_session" && k !== "i_parol_ok") scheduleSave();
    };
    var _rem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function (k) {
      _rem(k);
      if (k && k.indexOf("i_") === 0) scheduleSave();
    };
  }

  function pullThenStart() {
    pulling = true;
    sb.from(TABLE).select("data").eq("user_id", uid).maybeSingle().then(function (r) {
      pulling = false;
      if (r.data && r.data.data) {
        apply(r.data.data);
        sessionStorage.setItem("i_bulut_hydrated", "1");
        location.reload();
        return;
      }
      hookStorage(); pushNow(); badge();
    });
  }

  function afterAuth(user) {
    uid = user.id;
    removeGate();
    if (sessionStorage.getItem("i_bulut_hydrated") === "1") { hookStorage(); badge(); return; }
    pullThenStart();
  }

  // ---- bulut nuqtasi + hisob menyusi (parol qo'yish / chiqish) ----
  function badge() {
    if (document.getElementById("bulut-badge")) return;
    var b = document.createElement("div");
    b.id = "bulut-badge";
    b.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:99998;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);padding:5px 9px;border-radius:20px;font-size:11px;color:#fff;font-family:system-ui;cursor:pointer";
    b.innerHTML = '<span id="bulut-dot" style="width:8px;height:8px;border-radius:50%;background:#10B981;display:inline-block"></span><span>Hisob</span>';
    b.onclick = accountMenu;
    document.body.appendChild(b);
  }

  function accountMenu() {
    var em = "";
    try { sb.auth.getUser().then(function (r) { em = (r.data && r.data.user && r.data.user.email) || ""; }); } catch (e) {}
    var m = document.createElement("div");
    m.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui";
    m.innerHTML =
      '<div style="width:100%;max-width:420px;background:#fff;border-radius:20px 20px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px));color:#111">' +
        '<div style="width:40px;height:4px;background:#ddd;border-radius:2px;margin:0 auto 16px"></div>' +
        '<div style="font-size:18px;font-weight:800;margin-bottom:2px">Hisob</div>' +
        '<div id="acc-email" style="font-size:13px;color:#666;margin-bottom:16px">' + (em || "...") + '</div>' +
        '<button id="acc-pass" style="width:100%;padding:14px;border:1px solid #e5e5e5;border-radius:12px;background:#f7f7f7;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:10px">🔑 Parol qo\'yish / o\'zgartirish</button>' +
        '<button id="acc-out" style="width:100%;padding:14px;border:none;border-radius:12px;background:#FEE2E2;color:#B91C1C;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px">Chiqish</button>' +
        '<button id="acc-close" style="width:100%;padding:12px;border:none;border-radius:12px;background:transparent;color:#666;font-size:14px;cursor:pointer">Yopish</button>' +
      '</div>';
    document.body.appendChild(m);
    try { sb.auth.getUser().then(function (r) { var e = document.getElementById("acc-email"); if (e) e.textContent = (r.data && r.data.user && r.data.user.email) || ""; }); } catch (e) {}
    m.querySelector("#acc-close").onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    m.querySelector("#acc-out").onclick = function () {
      sb.auth.signOut().then(function () { sessionStorage.removeItem("i_bulut_hydrated"); location.reload(); });
    };
    m.querySelector("#acc-pass").onclick = function () {
      m.remove(); setPasswordDialog();
    };
  }

  function setPasswordDialog() {
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:22px;font-family:system-ui";
    d.innerHTML =
      '<div style="width:100%;max-width:340px;background:#fff;border-radius:18px;padding:20px;color:#111">' +
        '<div style="font-size:17px;font-weight:800;margin-bottom:4px">Parol qo\'yish</div>' +
        '<div style="font-size:13px;color:#666;margin-bottom:14px">Parol qo\'ysangiz, keyingi safar kod kutmасдан tez kirasiz.</div>' +
        '<input id="sp-pass" type="password" placeholder="Yangi parol (kamida 6 belgi)" style="width:100%;box-sizing:border-box;padding:13px;border:1px solid #e0e0e0;border-radius:11px;font-size:15px;outline:none;margin-bottom:8px">' +
        '<div id="sp-err" style="color:#DC2626;font-size:13px;min-height:16px;margin:2px 2px 8px"></div>' +
        '<button id="sp-go" style="width:100%;padding:13px;border:none;border-radius:11px;background:#00D4A0;color:#04231b;font-weight:800;font-size:15px;cursor:pointer">Saqlash</button>' +
        '<button id="sp-cancel" style="width:100%;padding:11px;border:none;border-radius:11px;background:transparent;color:#666;font-size:14px;cursor:pointer;margin-top:6px">Bekor qilish</button>' +
      '</div>';
    document.body.appendChild(d);
    d.querySelector("#sp-cancel").onclick = function () { d.remove(); };
    d.querySelector("#sp-go").onclick = function () {
      var pw = d.querySelector("#sp-pass").value || "";
      var err = d.querySelector("#sp-err");
      if (pw.length < 6) { err.textContent = "Parol kamida 6 ta belgi bo'lsin"; return; }
      sb.auth.updateUser({ password: pw }).then(function (r) {
        if (r.error) { err.textContent = r.error.message; return; }
        d.remove();
        toast("✅ Parol saqlandi");
      });
    };
  }

  function toast(t) {
    var el = document.createElement("div");
    el.textContent = t;
    el.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;z-index:100000;font-family:system-ui";
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  // ============================================================
  //  KIRISH oynasi — EMAIL + KOD (OTP), parol ixtiyoriy
  // ============================================================
  function gate() {
    var wrap = document.createElement("div");
    wrap.id = "bulut-gate";
    wrap.style.cssText = "position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#0b1220,#111827);display:flex;align-items:center;justify-content:center;padding:22px;font-family:system-ui,-apple-system,sans-serif";
    wrap.innerHTML =
      '<div style="width:100%;max-width:360px;color:#fff">' +
        '<div style="text-align:center;margin-bottom:22px">' +
          '<div style="font-size:40px">🎯</div>' +
          '<div style="font-size:26px;font-weight:800;margin-top:6px">Intizom</div>' +
          '<div id="bg-sub" style="font-size:14px;opacity:.7;margin-top:4px">Emailingizni kiriting — kod yuboramiz</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:18px">' +
          // 1-bosqich: email
          '<div id="bg-step1">' +
            '<input id="bg-email" type="email" inputmode="email" autocomplete="email" placeholder="Email" ' +
              'style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:15px;outline:none">' +
            '<div id="bg-err1" style="color:#FCA5A5;font-size:13px;min-height:18px;margin:8px 2px 0"></div>' +
            '<button id="bg-send" style="width:100%;padding:14px;border:none;border-radius:12px;background:#00D4A0;color:#04231b;font-weight:800;font-size:16px;cursor:pointer;margin-top:2px">Kod olish</button>' +
            '<div style="text-align:center;margin-top:12px;font-size:13px;opacity:.75">' +
              '<a id="bg-havepass" href="#" style="color:#93C5FD;text-decoration:none">Parolим bор — parol bilan kirаман</a>' +
            '</div>' +
          '</div>' +
          // 2-bosqich: kod
          '<div id="bg-step2" style="display:none">' +
            '<div style="font-size:13px;opacity:.8;margin-bottom:8px" id="bg-sent"></div>' +
            '<input id="bg-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6 xonali kod" ' +
              'style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:20px;letter-spacing:4px;text-align:center;outline:none">' +
            '<div id="bg-err2" style="color:#FCA5A5;font-size:13px;min-height:18px;margin:8px 2px 0"></div>' +
            '<button id="bg-verify" style="width:100%;padding:14px;border:none;border-radius:12px;background:#00D4A0;color:#04231b;font-weight:800;font-size:16px;cursor:pointer">Kirish</button>' +
            '<div style="text-align:center;margin-top:12px;font-size:13px;opacity:.75">' +
              '<a id="bg-back" href="#" style="color:#93C5FD;text-decoration:none">← Emailни o\'zгартириш</a>' +
            '</div>' +
          '</div>' +
          // parol bilan kirish
          '<div id="bg-stepP" style="display:none">' +
            '<input id="bg-pemail" type="email" inputmode="email" autocomplete="email" placeholder="Email" ' +
              'style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:15px;outline:none;margin-bottom:10px">' +
            '<input id="bg-ppass" type="password" autocomplete="current-password" placeholder="Parol" ' +
              'style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:15px;outline:none">' +
            '<div id="bg-errP" style="color:#FCA5A5;font-size:13px;min-height:18px;margin:8px 2px 0"></div>' +
            '<button id="bg-pgo" style="width:100%;padding:14px;border:none;border-radius:12px;background:#00D4A0;color:#04231b;font-weight:800;font-size:16px;cursor:pointer">Kirish</button>' +
            '<div style="text-align:center;margin-top:12px;font-size:13px;opacity:.75">' +
              '<a id="bg-tocode" href="#" style="color:#93C5FD;text-decoration:none">← Kod bilan kirish</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:center;font-size:11px;opacity:.4;margin-top:16px">Ma\'lumotlaringiz xavfsiz saqlanadi</div>' +
      '</div>';
    document.body.appendChild(wrap);

    var $ = function (id) { return wrap.querySelector(id); };
    var step1 = $("#bg-step1"), step2 = $("#bg-step2"), stepP = $("#bg-stepP");
    var curEmail = "";

    // --- 1: kod yuborish ---
    $("#bg-send").onclick = function () {
      var em = ($("#bg-email").value || "").trim();
      var err = $("#bg-err1");
      err.textContent = "";
      if (!em || em.indexOf("@") < 0) { err.textContent = "To'g'ri email kiriting"; return; }
      var btn = $("#bg-send"); btn.disabled = true; btn.textContent = "Yuborilmoqda...";
      // shouldCreateUser: true -> yangi bo'lsa ham avtomatik ochadi
      sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true } }).then(function (r) {
        btn.disabled = false; btn.textContent = "Kod olish";
        if (r.error) { err.textContent = tr(r.error.message); return; }
        curEmail = em;
        $("#bg-sent").textContent = em + " ga kod yuborildi. Pochtangizni tekshiring.";
        step1.style.display = "none"; step2.style.display = "block";
        setTimeout(function () { $("#bg-code").focus(); }, 100);
      });
    };
    $("#bg-email").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#bg-send").click(); });

    // --- 2: kodni tekshirish ---
    $("#bg-verify").onclick = function () {
      var code = ($("#bg-code").value || "").trim().replace(/\s/g, "");
      var err = $("#bg-err2");
      err.textContent = "";
      if (code.length < 4) { err.textContent = "Kodni to'liq kiriting"; return; }
      var btn = $("#bg-verify"); btn.disabled = true; btn.textContent = "...";
      sb.auth.verifyOtp({ email: curEmail, token: code, type: "email" }).then(function (r) {
        btn.disabled = false; btn.textContent = "Kirish";
        if (r.error) { err.textContent = "Kod noto'g'ri yoki eskirgan"; return; }
        if (r.data && r.data.user) afterAuth(r.data.user);
      });
    };
    $("#bg-code").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#bg-verify").click(); });
    $("#bg-back").onclick = function (e) { e.preventDefault(); step2.style.display = "none"; step1.style.display = "block"; };

    // --- parol bilan kirish ---
    $("#bg-havepass").onclick = function (e) {
      e.preventDefault();
      step1.style.display = "none"; stepP.style.display = "block";
      var pe = $("#bg-pemail"); if (($("#bg-email").value || "").trim()) pe.value = $("#bg-email").value.trim();
    };
    $("#bg-tocode").onclick = function (e) { e.preventDefault(); stepP.style.display = "none"; step1.style.display = "block"; };
    $("#bg-pgo").onclick = function () {
      var em = ($("#bg-pemail").value || "").trim();
      var pw = $("#bg-ppass").value || "";
      var err = $("#bg-errP");
      err.textContent = "";
      if (!em || em.indexOf("@") < 0) { err.textContent = "To'g'ri email kiriting"; return; }
      if (!pw) { err.textContent = "Parolni kiriting"; return; }
      var btn = $("#bg-pgo"); btn.disabled = true; btn.textContent = "...";
      sb.auth.signInWithPassword({ email: em, password: pw }).then(function (r) {
        btn.disabled = false; btn.textContent = "Kirish";
        if (r.error) { err.textContent = tr(r.error.message); return; }
        if (r.data && r.data.user) afterAuth(r.data.user);
      });
    };
    $("#bg-ppass").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#bg-pgo").click(); });
  }

  function tr(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0) return "Email yoki parol noto'g'ri";
    if (m.indexOf("rate") >= 0 || m.indexOf("too many") >= 0) return "Ko'p urinildi — biroz kuting";
    if (m.indexOf("password") >= 0) return "Parol xato yoki qisqa";
    return m;
  }

  function removeGate() { var g = document.getElementById("bulut-gate"); if (g) g.remove(); }

  function start() {
    loadSb().then(function () {
      sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session && r.data.session.user) afterAuth(r.data.session.user);
        else gate();
      });
    }).catch(function (e) { console.warn("Bulut ulanmadi:", e && e.message); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
