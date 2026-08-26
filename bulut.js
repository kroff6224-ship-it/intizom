/* ============================================================
   INTIZOM — Bulut sinxron + Email/parol kirish (bulut.js)
   Ilova kodiga tegmaydi. Ustidan ishlaydi:
     - Supabase auth (email + parol)
     - kirgach: serverdan ma'lumot -> localStorage -> render
     - har o'zgarishda: localStorage -> serverga saqlash (debounce)
   ============================================================ */
(function () {
  "use strict";

  var SUPA_URL = "https://kqtonpusgorwfqktbeto.supabase.co";
  var SUPA_KEY = "sb_publishable_bclhi6PMaXkdYB5JvpqCIQ_YpB5GJGN";
  var TABLE = "intizom_data";

  // ---- localStorage kalitlarini yig'ish (ilovaning o'z mantig'i bilan bir xil) ----
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

  // ---- Supabase klientini yuklash ----
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

  // ---- serverga saqlash (debounce 1.2s) ----
  function pushNow() {
    if (!sb || !uid || pulling) return;
    var row = { user_id: uid, data: collect(), updated_at: new Date().toISOString() };
    sb.from(TABLE).upsert(row, { onConflict: "user_id" }).then(function (r) {
      var dot = document.getElementById("bulut-dot");
      if (dot) { dot.style.background = r.error ? "#EF4444" : "#10B981"; }
    });
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, 1200);
  }

  // localStorage yozilishini ushlab, serverga saqlashni rejalashtiramiz
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

  // ---- serverdan tortish ----
  function pullThenStart() {
    pulling = true;
    sb.from(TABLE).select("data").eq("user_id", uid).maybeSingle().then(function (r) {
      pulling = false;
      if (r.data && r.data.data) {
        apply(r.data.data);
        // ma'lumot keldi -> ilovani qayta yuklab, to'g'ri ko'rsatamiz
        sessionStorage.setItem("i_bulut_hydrated", "1");
        location.reload();
        return;
      }
      // serverda hali yo'q -> hozirgi localStorage'ni birinchi bo'lib yuboramiz
      hookStorage();
      pushNow();
      badge();
    });
  }

  function afterAuth(user) {
    uid = user.id;
    removeGate();
    if (sessionStorage.getItem("i_bulut_hydrated") === "1") {
      // reload'dan keyin keldik — endi kuzatib turamiz
      hookStorage(); badge();
      return;
    }
    pullThenStart();
  }

  // ---- kichik holat nuqtasi (o'ng yuqorida) ----
  function badge() {
    if (document.getElementById("bulut-badge")) return;
    var b = document.createElement("div");
    b.id = "bulut-badge";
    b.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:99998;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);padding:5px 9px;border-radius:20px;font-size:11px;color:#fff;font-family:system-ui";
    b.innerHTML = '<span id="bulut-dot" style="width:8px;height:8px;border-radius:50%;background:#10B981;display:inline-block"></span><span>Bulut</span>';
    b.onclick = function () {
      if (confirm("Hisobdan chiqasizmi? (Ma'lumot serverda saqlanadi)")) {
        sb.auth.signOut().then(function () {
          sessionStorage.removeItem("i_bulut_hydrated");
          location.reload();
        });
      }
    };
    document.body.appendChild(b);
  }

  // ============================================================
  //  KIRISH / RO'YXATDAN O'TISH oynasi
  // ============================================================
  function gate() {
    var wrap = document.createElement("div");
    wrap.id = "bulut-gate";
    wrap.style.cssText = "position:fixed;inset:0;z-index:99999;background:linear-gradient(160deg,#0b1220,#111827);display:flex;align-items:center;justify-content:center;padding:22px;font-family:system-ui,-apple-system,sans-serif";
    wrap.innerHTML =
      '<div style="width:100%;max-width:360px;color:#fff">' +
        '<div style="text-align:center;margin-bottom:24px">' +
          '<div style="font-size:40px">🎯</div>' +
          '<div style="font-size:26px;font-weight:800;margin-top:6px">Intizom</div>' +
          '<div id="bg-sub" style="font-size:14px;opacity:.7;margin-top:4px">Hisobingizga kiring</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:18px">' +
          '<input id="bg-email" type="email" autocomplete="email" placeholder="Email" ' +
            'style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:15px;margin-bottom:10px;outline:none">' +
          '<input id="bg-pass" type="password" autocomplete="current-password" placeholder="Parol (kamida 6 belgi)" ' +
            'style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:15px;outline:none">' +
          '<div id="bg-err" style="color:#FCA5A5;font-size:13px;min-height:18px;margin:8px 2px 0"></div>' +
          '<button id="bg-go" style="width:100%;padding:14px;border:none;border-radius:12px;background:#00D4A0;color:#04231b;font-weight:800;font-size:16px;cursor:pointer;margin-top:6px">Kirish</button>' +
          '<div style="text-align:center;margin-top:14px;font-size:13px;opacity:.85">' +
            '<span id="bg-swap-t">Hisobingiz yo\'qmi? </span>' +
            '<a id="bg-swap" href="#" style="color:#00D4A0;text-decoration:none;font-weight:700">Ro\'yxatdan o\'tish</a>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:center;font-size:11px;opacity:.4;margin-top:16px">Ma\'lumotlaringiz xavfsiz saqlanadi</div>' +
      '</div>';
    document.body.appendChild(wrap);

    var mode = "signin"; // yoki "signup"
    var email = wrap.querySelector("#bg-email");
    var pass = wrap.querySelector("#bg-pass");
    var err = wrap.querySelector("#bg-err");
    var go = wrap.querySelector("#bg-go");
    var swap = wrap.querySelector("#bg-swap");
    var swapT = wrap.querySelector("#bg-swap-t");
    var sub = wrap.querySelector("#bg-sub");

    swap.onclick = function (e) {
      e.preventDefault();
      err.textContent = "";
      if (mode === "signin") {
        mode = "signup";
        go.textContent = "Ro'yxatdan o'tish";
        sub.textContent = "Yangi hisob yarating";
        swapT.textContent = "Hisobingiz bormi? ";
        swap.textContent = "Kirish";
      } else {
        mode = "signin";
        go.textContent = "Kirish";
        sub.textContent = "Hisobingizga kiring";
        swapT.textContent = "Hisobingiz yo'qmi? ";
        swap.textContent = "Ro'yxatdan o'tish";
      }
    };

    function submit() {
      var em = (email.value || "").trim();
      var pw = pass.value || "";
      err.textContent = "";
      if (!em || em.indexOf("@") < 0) { err.textContent = "To'g'ri email kiriting"; return; }
      if (pw.length < 6) { err.textContent = "Parol kamida 6 ta belgi bo'lsin"; return; }
      go.disabled = true; go.textContent = "...";
      var p = mode === "signup"
        ? sb.auth.signUp({ email: em, password: pw })
        : sb.auth.signInWithPassword({ email: em, password: pw });
      p.then(function (r) {
        go.disabled = false; go.textContent = (mode === "signup" ? "Ro'yxatdan o'tish" : "Kirish");
        if (r.error) {
          err.textContent = tr(r.error.message);
          return;
        }
        if (mode === "signup" && (!r.data.session)) {
          // email tasdiqlash yoqilgan bo'lsa
          err.style.color = "#86EFAC";
          err.textContent = "Emailingizga tasdiqlash xati yuborildi. Uni tasdiqlab, keyin kiring.";
          mode = "signin"; go.textContent = "Kirish";
          return;
        }
        if (r.data.user) afterAuth(r.data.user);
      });
    }
    go.onclick = submit;
    pass.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function tr(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("invalid login") >= 0) return "Email yoki parol noto'g'ri";
    if (m.indexOf("already registered") >= 0) return "Bu email allaqachon ro'yxatdan o'tgan";
    if (m.indexOf("email not confirmed") >= 0) return "Avval emailingizni tasdiqlang";
    if (m.indexOf("password") >= 0) return "Parol juda qisqa (kamida 6 belgi)";
    return m;
  }

  function removeGate() {
    var g = document.getElementById("bulut-gate");
    if (g) g.remove();
  }

  // ============================================================
  //  BOSHLASH
  // ============================================================
  function start() {
    loadSb().then(function () {
      sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session && r.data.session.user) {
          afterAuth(r.data.session.user);
        } else {
          gate();
        }
      });
    }).catch(function (e) {
      // internet yo'q bo'lsa — ilova baribir localStorage bilan ishlayveradi
      console.warn("Bulut ulanmadi:", e && e.message);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
