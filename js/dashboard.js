// js/dashboard.js
import {
  auth, db, storage,
  onAuthStateChanged, signOut,
  collection, doc, getDocs, setDoc, deleteDoc, updateDoc,
  query, orderBy, serverTimestamp,
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "./firebase-config.js";

// ========== DOM REFS ==========
const logoutButton = document.getElementById("logoutButton");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadForm = document.getElementById("uploadForm");
const videoTitle = document.getElementById("videoTitle");
const firmSelect = document.getElementById("firmSelect");
const orientationSelect = document.getElementById("orientationSelect");
const expiryDate = document.getElementById("expiryDate");
const uploadButton = document.getElementById("uploadButton");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const selectedFileName = document.getElementById("selectedFileName");
const videoList = document.getElementById("videoList");
const emptyState = document.getElementById("emptyState");
const videoTableContainer = document.getElementById("videoTableContainer");

// ========== STATE ==========
let selectedFile = null;
const firmsMap = new Map(); // firmId -> firmName

// ========== AUTH GUARD ==========
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadFirms();
  loadVideos();
});

// ========== LOGOUT ==========
logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Çıkış yapılırken hata oluştu:", error);
    alert("Çıkış yapılırken bir hata oluştu: " + error.message);
  }
});

// ========== LOAD FIRMS ==========
async function loadFirms() {
  try {
    const firmsSnapshot = await getDocs(collection(db, "firms"));
    firmsMap.clear();
    firmSelect.innerHTML = '<option value="">Firma Seçin</option>';

    firmsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      firmsMap.set(docSnap.id, data.name);
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = data.name;
      firmSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Firmalar yüklenirken hata oluştu:", error);
    alert("Firmalar yüklenemedi: " + error.message);
  }
}

// ========== FILE SELECTION (DRAG & DROP) ==========
dropZone.addEventListener("click", () => {
  fileInput.click();
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drop-zone-active");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drop-zone-active");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drop-zone-active");
  const file = e.dataTransfer.files[0];
  handleFileSelection(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  handleFileSelection(file);
});

function handleFileSelection(file) {
  if (!file) {
    clearFileSelection();
    return;
  }

  if (file.type !== "video/mp4") {
    alert("Yalnızca MP4 formatındaki videolar kabul edilmektedir.");
    clearFileSelection();
    return;
  }

  selectedFile = file;
  selectedFileName.textContent = file.name;
  selectedFileName.classList.remove("hidden");
  uploadForm.classList.remove("hidden");
}

function clearFileSelection() {
  selectedFile = null;
  fileInput.value = "";
  selectedFileName.textContent = "";
  selectedFileName.classList.add("hidden");
  uploadForm.classList.add("hidden");
}

// ========== UPLOAD VIDEO ==========
uploadButton.addEventListener("click", async () => {
  const title = videoTitle.value.trim();
  const firmId = firmSelect.value;
  const orientation = orientationSelect.value;

  if (!selectedFile) {
    alert("Lütfen bir video dosyası seçin.");
    return;
  }
  if (!title) {
    alert("Lütfen video başlığını girin.");
    return;
  }
  if (!firmId) {
    alert("Lütfen bir firma seçin.");
    return;
  }
  if (!orientation) {
    alert("Lütfen yönlendirme seçin.");
    return;
  }

  const fileName = Date.now() + "_" + selectedFile.name;
  const storageRef = ref(storage, "videos/" + fileName);
  const uploadTask = uploadBytesResumable(storageRef, selectedFile);

  progressContainer.classList.remove("hidden");
  uploadButton.disabled = true;

  uploadTask.on(
    "state_changed",
    (snapshot) => {
      const progress = Math.round(
        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
      );
      progressBar.style.width = progress + "%";
      progressText.textContent = progress + "%";
    },
    (error) => {
      console.error("Yükleme hatası:", error);
      alert("Video yüklenirken bir hata oluştu: " + error.message);
      uploadButton.disabled = false;
      progressContainer.classList.add("hidden");
    },
    async () => {
      try {
        const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
        const videoDoc = doc(collection(db, "videos"));
        await setDoc(videoDoc, {
          title,
          firmId,
          orientation,
          fileName,
          fileUrl,
          thumbnailUrl: "",
          isActive: true,
          expiresAt: expiryDate.value ? new Date(expiryDate.value) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Reset form
        videoTitle.value = "";
        firmSelect.value = "";
        orientationSelect.value = "";
        expiryDate.value = "";
        clearFileSelection();
        progressContainer.classList.add("hidden");
        progressBar.style.width = "0%";
        progressText.textContent = "0%";
        uploadButton.disabled = false;

        await loadVideos();
      } catch (error) {
        console.error("Video kaydedilirken hata oluştu:", error);
        alert("Video kaydedilemedi: " + error.message);
        uploadButton.disabled = false;
        progressContainer.classList.add("hidden");
      }
    }
  );
});

// ========== LOAD VIDEOS ==========
async function loadVideos() {
  try {
    const videosQuery = query(
      collection(db, "videos"),
      orderBy("createdAt", "desc")
    );
    const videosSnapshot = await getDocs(videosQuery);

    videoList.innerHTML = "";

    if (videosSnapshot.empty) {
      emptyState.classList.remove("hidden");
      videoTableContainer.classList.add("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    videoTableContainer.classList.remove("hidden");

    videosSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const videoId = docSnap.id;
      const firmName = firmsMap.get(data.firmId) || "Bilinmiyor";
      const badgeClass = getOrientationBadgeClass(data.orientation);
      const orientationLabel = getOrientationLabel(data.orientation);
      const expiryDisplay = formatDate(data.expiresAt);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-3">
          ${
            data.thumbnailUrl
              ? `<img src="${data.thumbnailUrl}" alt="${data.title}" class="w-16 h-10 object-cover rounded">`
              : `<div class="w-16 h-10 bg-gray-200 rounded flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
                   </svg>
                 </div>`
          }
        </td>
        <td class="px-4 py-3 font-medium text-gray-900">${data.title}</td>
        <td class="px-4 py-3 text-gray-600">${firmName}</td>
        <td class="px-4 py-3">
          <span class="${badgeClass}">${orientationLabel}</span>
        </td>
        <td class="px-4 py-3 text-gray-600">${expiryDisplay}</td>
        <td class="px-4 py-3">
          <div class="toggle-switch ${data.isActive ? "active" : ""}" data-id="${videoId}" data-active="${data.isActive}"></div>
        </td>
        <td class="px-4 py-3">
          <button class="delete-btn bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded" data-id="${videoId}" data-filename="${data.fileName}">
            Sil
          </button>
        </td>
      `;
      videoList.appendChild(tr);
    });

    // Attach toggle and delete event listeners
    document.querySelectorAll(".toggle-switch").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const id = toggle.dataset.id;
        const currentState = toggle.dataset.active === "true";
        toggleVideo(id, currentState);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const fileName = btn.dataset.filename;
        deleteVideo(id, fileName);
      });
    });
  } catch (error) {
    console.error("Videolar yüklenirken hata oluştu:", error);
    alert("Videolar yüklenemedi: " + error.message);
  }
}

// ========== TOGGLE VIDEO ==========
async function toggleVideo(videoId, currentState) {
  try {
    await updateDoc(doc(db, "videos", videoId), {
      isActive: !currentState,
      updatedAt: serverTimestamp()
    });
    await loadVideos();
  } catch (error) {
    console.error("Video durumu güncellenirken hata oluştu:", error);
    alert("Video durumu güncellenemedi: " + error.message);
  }
}

// ========== DELETE VIDEO ==========
async function deleteVideo(videoId, fileName) {
  if (!confirm("Bu videoyu silmek istediğinize emin misiniz?")) return;

  try {
    await deleteObject(ref(storage, "videos/" + fileName));
  } catch (error) {
    // If file not found in storage, continue with Firestore deletion
    console.warn("Storage'dan dosya silinemedi (devam ediliyor):", error);
  }

  try {
    await deleteDoc(doc(db, "videos", videoId));
    await loadVideos();
  } catch (error) {
    console.error("Video silinirken hata oluştu:", error);
    alert("Video silinemedi: " + error.message);
  }
}

// ========== ORIENTATION HELPERS ==========
function getOrientationLabel(value) {
  switch (value) {
    case "horizontal": return "Yatay";
    case "vertical": return "Dikey";
    case "both": return "Ortak";
    default: return value;
  }
}

function getOrientationBadgeClass(value) {
  switch (value) {
    case "horizontal": return "badge-horizontal";
    case "vertical": return "badge-vertical";
    case "both": return "badge-both";
    default: return "";
  }
}

function formatDate(dateValue) {
  if (!dateValue) return "Sınırsız";
  try {
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return date.toLocaleDateString("tr-TR");
  } catch {
    return "Sınırsız";
  }
}
