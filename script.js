let liveWatcherId = null;
let quickAuthority = null;
let activeEmergencies = new Set();
let emergencySent = false;
let lockedLocation = null;
let lastSentCategory = null;
let guidanceMode = false;
let lockedCategory = null;
let pendingPhoto = null;
let photoIntent = null; // "self" | "other"

// STORE USER PROFILE (GLOBAL)
let userProfile = {
  name: "",
  age: "",
  medical: "",
  mobile: ""
};

let liveLocation = "Fetching location...";
const EMERGENCY_PRIORITY = {
  "Fire Service": 1,
  "Medical Emergency": 2,
  "Disaster Management": 3,
  "Police": 4
};
function show(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
  }
}

function getLiveLocation(callback) {
  if (!navigator.geolocation) {
    callback("Location not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);
      liveLocation = `Lat ${lat}, Lon ${lon}`;
      callback(liveLocation);
    },
    () => callback("Location unavailable"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
const authorityChannel = new BroadcastChannel("emergency_channel");

 const RESPONSE_DELAY = 800; // ms
const AUTO_SEND_TIMEOUT = 60000; // 1 minute



function verifyOTP() {
  const otp = document.getElementById("otp").value;

  if (!/^\d{4}$/.test(otp)) {
    alert("OTP must be exactly 4 digits.");
    return;
  }

  if (otp !== "1234") {
    alert("Incorrect OTP");
    return;
  }

  show("screen-terms");
}

function acceptTerms() {
  const agreed = document.getElementById("agreeCheck").checked;
  if (!agreed) {
    alert("Please accept the Terms & Conditions to continue.");
    return;
  }
  show("screen-app");
}

/* RISK SYSTEM */
let riskScore = 10;
let confirmTimer = null;
let emergencyActive = false;
let currentCategory = null;
const THRESHOLD = 90;

/* CHAT */
function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim().toLowerCase();

  if (!text) return;

  addMessage(text, "user");
input.value = "";

// 🚨 EXPLICIT OVERRIDE (works even during emergency)
if (isExplicitCall(text)) {

  if (text.includes("police")) {
    currentCategory = "Police";
  }
  else if (text.includes("ambulance") || text.includes("doctor")) {
    currentCategory = "Medical Emergency";
  }
  else if (text.includes("fire")) {
    currentCategory = "Fire Service";
  }
  else {
    currentCategory = "Emergency";
  }

  // 🔒 VERY IMPORTANT: lock the category
  lockedCategory = currentCategory;

  respond("🚨 Sending your details now.");
  confirmEmergency(); // immediate send
  return;
}


// 🔒 Emergency already active → guidance only
if (guidanceMode) {
  respond(getAdaptiveResponse(text));
  giveGuidance(lockedCategory);
  return;
}
// 😌 USER CALMS DOWN
if (isCalmStatement(text) && !emergencyActive) {
  reduceRisk();
  respond("Okay. I’m glad you’re safe. I’m here if you need anything.");
  return;
}


  // ✅ RESET
  if (isReset(text)) {
    resetSystem("Okay. You’re safe now.");
    return;
  }



  // ===============================
  // NORMAL FLOW
  // ===============================
  increaseRisk(text);
  healthInstructions(text);
  disasterAwareness(text);
  if (!emergencyActive && shouldEnableSilentMode(currentCategory)) {
  enableSilentModeUI();
}

  updateUI();
  setTimeout(empatheticResponse, RESPONSE_DELAY);

  if (riskScore >= THRESHOLD && !emergencyActive) {
    openConfirm(true);
  }
  updateUI();

}



/* RISK */
function increaseRisk(t) {
  if (t.includes("fire") 
    || t.includes("burning")
    || t.includes("flames")
    || t.includes("smoke")) {
    addRisk(50, "Fire Service");
  }
  else if (
  t.includes("bleeding") ||
  t.includes("blood") ||
  t.includes("cut") ||
  t.includes("wound") ||
  t.includes("injured") ||
  t.includes("hurt")
) {
    addRisk(15, "Medical Emergency");
  }
  else if (t.includes("earthquake") || t.includes("flood") || t.includes("tsunami")|| t.includes("cyclone")|| t.includes("landslide")) {
    addRisk(35, "Disaster Management");
  }
  else if (t.includes("kidnap") || t.includes("attack")|| t.includes("fighting")|| t.includes("threat")|| t.includes("stalking")|| t.includes("robbery")|| t.includes("afraid")|| t.includes("scared")) {
    addRisk(45, "Police");
  }
  else if (t.includes("help") || t.includes("scared")) {
  respond("I’m here with you. Stay calm. You are not alone.");
}


  else {
    riskScore += 5;
  }
}


function addRisk(val, cat) {
 if (emergencyActive) return; 

  riskScore += val;
  activeEmergencies.add(cat);

  let sorted = [...activeEmergencies].sort(
    (a, b) => EMERGENCY_PRIORITY[a] - EMERGENCY_PRIORITY[b]
  );

  currentCategory = sorted[0];
}

function reduceRisk() {
  if (riskScore < THRESHOLD  && currentCategory !== "Police") {
  disableSilentModeUI();
}

  if (emergencyActive) return; // 🚫 never reduce after SOS

  riskScore = Math.max(0, riskScore - 15);

  if (riskScore === 0) {
    currentCategory = null;
  }

  updateUI();
}


/* RESET */
function isReset(t) {
  return ["i am fine","i'm fine","i don't need help","perfectly alright","i am okay"].some(p => t.includes(p));
}
function isCalmStatement(text) {
  return (
    text.includes("i am fine") ||
    text.includes("i'm fine") ||
    text.includes("i am okay") ||
    text.includes("i'm okay") ||
    text.includes("i feel safe") ||
    text.includes("everything is okay") ||
    text.includes("nothing happened")
  );
}

function shouldEnableSilentMode(category) {
  return category === "Police";
}

function resetSystem(msg) {
  clearTimeout(confirmTimer);
  emergencyActive = false;
  emergencySent = false;
  lockedLocation = null;
  riskScore = 10;
  currentCategory = null;
  closeConfirm();
  setState("🙂", "SAFE MODE");
  addMessage(msg, "bot");
  if (liveWatcherId !== null) {
  navigator.geolocation.clearWatch(liveWatcherId);
  liveWatcherId = null;
  disableSilentModeUI();

}

}


/* UI */
function updateUI() {
  if (riskScore < 30) setState("🙂","SAFE MODE");
  else if (riskScore < 60) setState("😟","MONITORING");
  else setState("😟","HIGH RISK");
}

function setState(emoji,text) {
  document.getElementById("cloud").innerText = emoji;
  document.getElementById("status").innerText = text;
}

/* CONFIRM */
function openConfirm(forceSend = false) {
  lockedCategory = currentCategory;

  confirmVisible = true;        // 👈 keep asking permission
  // ❌ DO NOT set emergencyActive here

  const box = document.getElementById("confirmBox");
  document.getElementById("confirmText").innerText =
    `Send location and details to ${currentCategory || "emergency contacts"}?`;

  box.style.display = "flex";
  box.classList.remove("hidden");

  confirmTimer = setTimeout(
    forceSend ? confirmEmergency : closeConfirm,
    AUTO_SEND_TIMEOUT
  );
}



function startLiveLocation() {
  if (!navigator.geolocation) return;

  liveWatcherId = navigator.geolocation.watchPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);
      const updatedLocation = `Lat ${lat}, Lon ${lon}`;

      // send update to authority dashboard
      authorityChannel.postMessage({
        type: "LIVE_UPDATE",
        location: updatedLocation,
        time: new Date().toLocaleString()
      });
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}


function confirmEmergency() {
  emergencyActive = true; // lock only when actually sending
confirmVisible = false;
if (!userProfile.name || !userProfile.age) {
  respond("Please complete your details before I contact authorities.");
  return;
}
if (shouldEnableSilentMode(lockedCategory)) {
  enableSilentModeUI();
}

  // ❌ Block only SAME emergency repetition
  if (emergencySent && currentCategory === lastSentCategory) {
    respond("Emergency services are already notified. I’m staying with you.");
    return;
  }

  emergencySent = true;
  lastSentCategory = currentCategory;
  guidanceMode = true; // 🔒 lock emergency system
  if (lockedCategory === "Police") {
  enableSilentModeUI();
}

  startLiveLocation();

  clearTimeout(confirmTimer);
  closeConfirm();
  setState("😨", "EMERGENCY SENT");
  
  getLiveLocation(location => {
    // 🔐 Lock first valid location
    if (!lockedLocation && location !== "Location unavailable") {
      lockedLocation = location;
    }

    const payload = {
      name: userProfile.name,
      age: userProfile.age,
      medical: userProfile.medical,
      emergencyType: lockedCategory,   // ✅ REAL CATEGORY
      riskScore: riskScore,
      location: lockedLocation || location || "Location pending",
      time: new Date().toLocaleString(),
      photoAttached: pendingPhoto ? true : false,
      photo: pendingPhoto || null

    };

    authorityChannel.postMessage(payload);

    addMessage(
      `🚨 SOS SENT\n📍 ${payload.location}\n⚠️ ${lockedCategory}`,
      "bot"
    );

    addMessage("📨 Emergency contacts notified.", "bot");
  });
}



function cancelEmergency() {
  resetSystem("Emergency cancelled.");
}

function closeConfirm() {
  const box = document.getElementById("confirmBox");
  box.classList.add("hidden");
  box.style.display = "none";        // 👈 hide explicitly
}


/* CHAT HELPERS */
function addMessage(msg,type) {
  const d=document.createElement("div");
  d.className="message "+type;
  d.innerText=msg;
  document.getElementById("chat").appendChild(d);
}

/* MIC */
function startListening() {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Use Google Chrome for microphone.");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const spokenText = event.results[0][0].transcript.trim();
    if (spokenText) {
      document.getElementById("chatInput").value = spokenText;
      recognition.stop();          // ✅ IMPORTANT
      sendMessage();               // ✅ auto-send
    }
  };

  recognition.onerror = () => {
    recognition.stop();            // ✅ IMPORTANT
    alert("Microphone error. Please allow mic permission.");
  };

  recognition.start();
}



function autoRespondByRisk() {
  if (riskScore < 30) {
    respond("I’m here with you. Please continue communicating.");
  } 
  else if (riskScore < 60) {
    respond("I’m monitoring the situation. Try to stay calm and keep me updated.");
  } 
  else if (riskScore < THRESHOLD) {
    respond("This seems serious. Help may be needed. I’m staying alert.");
  }
}
function healthInstructions(text) {
  const medicalDanger =
    text.includes("bleeding") ||
    text.includes("blood") ||
    text.includes("faint") ||
    text.includes("dizzy") ||
    text.includes("chest pain") ||
    text.includes("breathing") ||
    text.includes("vomiting") ||
    text.includes("unconscious");

  if (!medicalDanger) return;

  respond("I’m concerned about your condition.");

  // If fire already active, ASK before medical escalation
  if (emergencyActive && activeEmergencies.has("Fire Service")) {
    if (!activeEmergencies.has("Medical Emergency")) {
      respond("Do you want me to also contact medical emergency services?");
      addRisk(20, "Medical Emergency");
    }
  } else {
    addRisk(20, "Medical Emergency");
    respond("If possible, apply pressure and stay still.");
  }
}

function disasterAwareness(text) {
  if (text.includes("earthquake")) {
    riskScore += 15;
    respond("I understand there may be an earthquake. Are you safe right now?");
  }

  if (text.includes("flood") || text.includes("tsunami")) {
    riskScore += 20;
    respond("Flooding can be dangerous. Are you in a safe location right now?");
  }

  if (text.includes("kidnap")) {
    riskScore += 25;
    respond("This is serious. If possible, try to stay calm. I’m here with you.");
  }
}
function empatheticResponse() {
  if (riskScore < 30) {
    respond("I’m here with you. You’re doing the right thing by reaching out.");
  } 
  else if (riskScore < 60) {
    respond("I know this can feel stressful. Stay with me and keep updating me.");
  } 
  else if (riskScore < THRESHOLD) {
    respond("I understand this is frightening. You’re not alone. I’m staying with you.");
  }
}
function validateUserDetails() {
  const name = document.getElementById("fullName").value.trim();
  const mobile = document.getElementById("mobileNumber").value;
  const age = document.getElementById("age").value;
  const medical = document.getElementById("medicalInfo").value.trim();

  if (!name) {
    alert("Please enter your name.");
    return;
  }

  if (!/^\d{10}$/.test(mobile)) {
    alert("Please enter a valid 10-digit mobile number.");
    return;
  }

  if (age < 1 || age > 120) {
    alert("Please enter a valid age.");
    return;
  }

  // SAVE USER DATA
  userProfile.name = name;
  userProfile.mobile = mobile;
  userProfile.age = age;
  userProfile.medical = medical;

  show("screen-details2");
}

function validateEmergencyContacts() {
  const c1 = document.getElementById("ec1").value;
  const c2 = document.getElementById("ec2").value;
  const c3 = document.getElementById("ec3").value;

  // At least one required
  if (!/^\d{10}$/.test(c1)) {
    alert("Emergency Contact 1 must be a valid 10-digit number.");
    return;
  }

  // Optional contacts validation
  if (c2 && !/^\d{10}$/.test(c2)) {
    alert("Emergency Contact 2 must be a valid 10-digit number.");
    return;
  }

  if (c3 && !/^\d{10}$/.test(c3)) {
    alert("Emergency Contact 3 must be a valid 10-digit number.");
    return;
  }

  show("screen-otp");
}
function respond(message) {
  addMessage(message, "bot");
}
function giveGuidance(category) {
  if (category === "Medical Emergency") {
    respond("🩺 If bleeding, apply gentle pressure. Stay still if possible.");
  }
  else if (category === "Fire Service") {
    respond("🔥 Stay low to avoid smoke. Move away from flames.");
  }
  else if (category === "Police") {
    respond("🚓 Stay in a safe place. Avoid confrontation.");
  }
  else if (category === "Disaster Management") {
    respond("🌊 Move to a safer area if possible. Stay alert.");
  }
}
function getAdaptiveResponse(text) {
  text = text.toLowerCase();

  // AFTER SOS IS SENT
  if (emergencyActive) {
    if (lockedCategory === "Fire Service") {
      return "🚨 Emergency services are on the way. Move away from flames if you can and follow fire safety instructions nearby.";
    }

    if (lockedCategory === "Medical Emergency") {
      return "🚨 Help is on the way. Stay still if possible and keep yourself safe. I’m here with you.";
    }

    if (lockedCategory === "Police") {
      return "🚨 Authorities are on the way. Stay calm and avoid confrontation if possible.";
    }

    return "🚨 Emergency help is on the way. Stay safe and keep updating me.";
  }

  // BEFORE SOS (monitoring phase)
  if (text.includes("bleeding")) {
    return "I’m concerned about your condition. Can you tell me how serious the bleeding is?";
  }

  if (text.includes("fire")) {
    return "That sounds dangerous. Are you inside a building or outside right now?";
  }

  if (text.includes("help") || text.includes("scared")) {
    return "I’m here with you. Take a slow breath and tell me what’s happening.";
  }

  // DEFAULT
  return "I’m listening. Please tell me more so I can help you better.";
}

document.getElementById("chatInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("chatInput");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
});
function decidePriority(text) {
  if (text.includes("fire") || text.includes("smoke") || text.includes("burning")) {
    return "Fire Service";
  }

  if (
    text.includes("earthquake") ||
    text.includes("flood") ||
    text.includes("cyclone")
  ) {
    return "Disaster Management";
  }

  if (
    text.includes("attack") ||
    text.includes("stalking") ||
    text.includes("kidnap")
  ) {
    return "Police";
  }

  if (
    text.includes("bleeding") ||
    text.includes("blood") ||
    text.includes("injured") ||
    text.includes("dizzy")
  ) {
    return "Medical Emergency";
  }

  return null;
}
function isExplicitCall(text) {
  return (
    text.includes("call police") ||
    text.includes("call ambulance") ||
    text.includes("call fire") ||
    text.includes("fire brigade")
  );
}
function detectExplicitCategory(text) {
  if (text.includes("police")) return "Police";
  if (text.includes("ambulance") || text.includes("doctor")) return "Medical Emergency";
  if (text.includes("fire")) return "Fire Service";
  return "Emergency";
}

function openUserCamera() {
  photoIntent = "self";
  document.getElementById("quickPhoto").click();
}

// 🟥 Open camera


// 🟥 After photo is taken
function sendQuickReport(event) {
  const file = event.target.files[0];
  if (!file) return;

  /* ============================
     CASE 1 — PHOTO FOR SELF
     ============================ */
  if (photoIntent === "self") {
    pendingPhoto = file; // store for later SOS

    // Optional preview in chat (UX)
    const imgURL = URL.createObjectURL(file);
    addMessage("📸 Photo captured. It will be sent if SOS is triggered.", "bot");
    addImageToChat(imgURL);

    photoIntent = null;
    return;
  }

  /* ============================
     CASE 2 — HELPING SOMEONE ELSE
     ============================ */
  if (photoIntent === "other") {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(5);
      const lon = pos.coords.longitude.toFixed(5);

      authorityChannel.postMessage({
  type: "QUICK_REPORT",
  emergencyType: quickAuthority,
  location: `Lat ${lat}, Lon ${lon}`,
  time: new Date().toLocaleString(),
  photo: file
});


      quickAuthority = null;
      photoIntent = null;

      alert("🚨 Emergency reported for someone else.");
    });

    return;
  }
}




function openQuickAuthorityBox() {
  const box = document.getElementById("quickAuthorityBox");
  box.style.display = "flex";
  box.style.pointerEvents = "auto";
}


function closeQuickAuthority() {
  document.getElementById("quickAuthorityBox").style.display = "none";
}

function selectQuickAuthority(authority) {
  quickAuthority = authority;
  photoIntent = "other";
  closeQuickAuthority();
  document.getElementById("quickPhoto").click();
}
function enableSilentModeUI() {
  document.body.classList.add("silent-mode");
  respond(
  "🔕 Silent Mode activated. Keep your screen dim and avoid drawing attention."
);

}

function disableSilentModeUI() {
  document.body.classList.remove("silent-mode");
}

function addImageToChat(imageURL) {
  const img = document.createElement("img");
  img.src = imageURL;
  img.style.maxWidth = "100%";
  img.style.borderRadius = "8px";
  img.style.marginTop = "6px";

  const wrapper = document.createElement("div");
  wrapper.className = "message user";
  wrapper.appendChild(img);

  document.getElementById("chat").appendChild(wrapper);
}
