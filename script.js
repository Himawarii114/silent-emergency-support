let activeEmergencies = new Set();
let emergencySent = false;
let lockedLocation = null;
let lastSentCategory = null;

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

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

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

  // ✅ RESET
  if (isReset(text)) {
    resetSystem("Okay. You’re safe now.");
    return;
  }

  // ===============================
  // EXPLICIT AUTHORITY REQUESTS
  // ===============================

  // 🔥 FIRE
  if (
    text.includes("call fire") ||
    text.includes("fire brigade") ||
    text.includes("call fire service")
  ) {
    respond("I understand. I’m contacting the fire service now.");

    if (currentCategory !== "Fire Service") {
      emergencyActive = false;
      addRisk(100, "Fire Service");
      openConfirm(true);
    }
    return;
  }

  // 🚑 MEDICAL
  if (
    text.includes("call ambulance") ||
    text.includes("send ambulance") ||
    text.includes("medical emergency") ||
    text.includes("medical help") ||
    text.includes("call doctor")
  ) {
    respond("I understand. I’m contacting medical emergency services now.");

    if (currentCategory !== "Medical Emergency") {
      emergencyActive = false;
      addRisk(100, "Medical Emergency");
      openConfirm(true);
    }
    return;
  }

  // 🚓 POLICE
  if (
    text.includes("call police") ||
    text.includes("police help") ||
    text.includes("contact police")
  ) {
    respond("I understand. I’m contacting the police now.");

    if (currentCategory !== "Police") {
      emergencyActive = false;
      addRisk(100, "Police");
      openConfirm(true);
    }
    return;
  }

  // 🌊 DISASTER MANAGEMENT
  if (
    text.includes("disaster management") ||
    text.includes("call disaster")
  ) {
    respond("I understand. I’m contacting disaster management services now.");

    if (currentCategory !== "Disaster Management") {
      emergencyActive = false;
      addRisk(100, "Disaster Management");
      openConfirm(true);
    }
    return;
  }

  // ===============================
  // NORMAL FLOW
  // ===============================
  increaseRisk(text);
  healthInstructions(text);
  disasterAwareness(text);

  updateUI();
  setTimeout(empatheticResponse, RESPONSE_DELAY);

  if (riskScore >= THRESHOLD && !emergencyActive) {
    openConfirm(true);
  }
}



/* RISK */
function increaseRisk(t) {
  if (t.includes("fire") || t.includes("burning")) {
    addRisk(50, "Fire Service");
  }
  else if (t.includes("bleeding") || t.includes("injured")) {
    addRisk(40, "Medical Emergency");
  }
  else if (t.includes("earthquake") || t.includes("flood") || t.includes("tsunami")) {
    addRisk(35, "Disaster Management");
  }
  else if (t.includes("kidnap") || t.includes("attack")) {
    addRisk(45, "Police");
  }
  else if (t.includes("help") || t.includes("scared")) {
  riskScore += 10;
  respond("I’m here with you. Tell me what’s happening.");
}

  else {
    riskScore += 5;
  }
}


function addRisk(val, cat) {
  riskScore += val;

  // Add to active emergencies
  activeEmergencies.add(cat);

  // Pick highest priority emergency
  let sorted = [...activeEmergencies].sort(
    (a, b) => EMERGENCY_PRIORITY[a] - EMERGENCY_PRIORITY[b]
  );

  currentCategory = sorted[0];
}


/* RESET */
function isReset(t) {
  return ["i am fine","i'm fine","i don't need help","perfectly alright","i am okay"].some(p => t.includes(p));
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

  emergencyActive = true;

  const box = document.getElementById("confirmBox");
  document.getElementById("confirmText").innerText =
    `Send location and details to ${currentCategory || "emergency contacts"}?`;

  box.style.display = "flex";        // 👈 show explicitly
  box.classList.remove("hidden");

  confirmTimer = setTimeout(
  forceSend ? confirmEmergency : closeConfirm,
  AUTO_SEND_TIMEOUT
);

}


function confirmEmergency() {
  // ❌ Block only SAME emergency repetition
  if (emergencySent && currentCategory === lastSentCategory) {
    respond("Emergency services are already notified. I’m staying with you.");
    return;
  }

  emergencySent = true;
  lastSentCategory = currentCategory;

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
      emergencyType: currentCategory,   // ✅ REAL CATEGORY
      riskScore: riskScore,
      location: lockedLocation || location || "Location pending",
      time: new Date().toLocaleString()
    };

    authorityChannel.postMessage(payload);

    addMessage(
      `🚨 SOS SENT\n📍 ${payload.location}\n⚠️ ${currentCategory}`,
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
    addRisk(40, "Medical Emergency");
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
