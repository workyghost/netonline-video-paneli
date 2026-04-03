// js/dashboard.js
import {
  auth, db, storage,
  onAuthStateChanged, signOut,
  collection, doc, getDocs, setDoc, deleteDoc, updateDoc,
  query, orderBy, serverTimestamp,
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "./firebase-config.js";

// ========== DOM REFS ==========
const logoutButton       = document.getElementById("logoutButton");
const dropZone           = document.getElementById("dropZone");
const fileInput          = document.getElementById("fileInput");
const uploadForm         = document.getElementById("uploadForm");
const titleContainer     = document.getElementById("titleContainer");
const videoTitle         = document.getElementById("videoTitle");
const firmSelect         = document.getElementById("firmSelect");
const orientationSelect  = document.getElementById("orientationSelect");
const expiryDate         = document.getElementById("expiryDate");
const uploadButton       = document.getElementById("uploadButton");
const progressContainer  = document.getElementById("progressContainer");
const progressBar        = document.getElementById("progressBar");
const progressText       = document.getElementById("progressText");
const progressLabel      = document.getElementById("progressLabel");
const selectedFileName   = document.getElementById("selectedFileName");
const videoList          = document.getElementById("videoList");
const emptyState         = document.getElementById("emptyState");
const videoTableContainer = document.getElementById("videoTableContainer");

// ========== STATE ==========
let selectedFiles = [];
const firmsMap = new Map(); // firmId -> firmName

// ========== XSS HELPER ==========
function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(String(str ?? "")));
  return d.innerHTML;
}

// ========== AUTH GUARD ==========
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  await loadFirms();
  await loadVideos();
});

// ========== LOGOUT ==========
logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Çıkış yapılırken hata:", error);
    alert("Çıkış yapılırken hata: " + error.message);
  }
});

// ========== LOAD FIRMS ==========
async function loadFirms() {
  try {
    const firmsSnapshot = await getDocs(collection(db, "firms"));
    firmsMap.clear();
    firmSelect.innerHTML = '<option value="">Firma seçin...</option>';
    firmsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      firmsMap.set(docSnap.id, data.name);
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = data.name;
      firmSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Firmalar yüklenirken hata:", error);
    alert("Firmalar yüklenemedi: " + error.message);
  }
}

// ========== FILE SELECTION (DRAG & DROP + MULTI) ==========
dropZone.addEventListener("click", () => fileInput.click());

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
  handleFileSelection(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  handleFileSelection(fileInput.files);
});

function handleFileSelection(files) {
  if (!files || files.length === 0) {
    clearFileSelection();
    return;
  }

  const validFiles = Array.from(files).filter(f => f.type === "video/mp4");
  if (validFiles.length === 0) {
    alert("Yalnızca MP4 formatındaki videolar kabul edilmektedir.");
    clearFileSelection();
    return;
  }
  if (validFiles.length < files.length) {
    alert(`${files.length - validFiles.length} dosya MP4 değil ve atlandı.`);
  }

  selectedFiles = validFiles;

  if (selectedFiles.length === 1) {
    // Single file: auto-fill editable title
    const nameWithoutExt = selectedFiles[0].name.replace(/\.[^/.]+$/, "");
    videoTitle.value = nameWithoutExt.replace(/[-_]/g, " ");
    titleContainer.classList.remove("hidden");
    selectedFileName.textContent = selectedFiles[0].name;
  } else {
    // Multiple files: title generated per file from filename
    videoTitle.value = "";
    titleContainer.classList.add("hidden");
    selectedFileName.textContent = `${selectedFiles.length} video seçildi`;
  }

  selectedFileName.classList.remove("hidden");
  uploadForm.classList.remove("hidden");
}

function clearFileSelection() {
  selectedFiles = [];
  fileInput.value = "";
  selectedFileName.textContent = "";
  selectedFileName.classList.add("hidden");
  uploadForm.classList.add("hidden");
  titleContainer.classList.remove("hidden");
}

// ========== UPLOAD VIDEOS ==========
uploadButton.addEventListener("click", async () => {
  const firmId      = firmSelect.value;
  const orientation = orientationSelect.value;

  if (selectedFiles.length === 0) { alert("Lütfen bir video dosyası seçin."); return; }
  if (selectedFiles.length === 1 && !videoTitle.value.trim()) { alert("Lütfen video başlığını girin."); return; }
  if (!firmId)       { alert("Lütfen bir firma seçin."); return; }
  if (!orientation)  { alert("Lütfen yönlendirme seçin."); return; }

  uploadButton.disabled = true;
  progressContainer.classList.remove("hidden");

  const total = selectedFiles.length;
  for (let i = 0; i < total; i++) {
    const file  = selectedFiles[i];
    const title = total === 1
      ? videoTitle.value.trim()
      : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    if (total > 1) {
      progressLabel.textContent = `Video ${i + 1} / ${total} yükleniyor...`;
    } else {
      progressLabel.textContent = "Yükleniyor...";
    }
    progressBar.style.width = "0%";
    progressText.textContent = "0%";

    try {
      await uploadSingleFile(file, title, firmId, orientation, expiryDate.value);
    } catch (err) {
      console.error("Yükleme hatası:", err);
      alert(`"${file.name}" yüklenemedi: ${err.message}`);
    }
  }

  // Reset
  videoTitle.value = "";
  firmSelect.value = "";
  orientationSelect.value = "";
  expiryDate.value = "";
  clearFileSelection();
  progressContainer.classList.add("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
  progressLabel.textContent = "Yükleniyor...";
  uploadButton.disabled = false;

  await loadVideos();
});

function uploadSingleFile(file, title, firmId, orientation, expiry) {
  return new Promise((resolve, reject) => {
    const fileName   = Date.now() + "_" + file.name;
    const storageRef = ref(storage, "videos/" + fileName);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        progressBar.style.width = pct + "%";
        progressText.textContent = pct + "%";
      },
      reject,
      async () => {
        try {
          const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);

          let thumbnailUrl = "";
          try {
            thumbnailUrl = await generateThumbnail(file, fileName);
          } catch (thumbErr) {
            console.warn("Thumbnail oluşturulamadı:", thumbErr);
          }

          const videoDoc = doc(collection(db, "videos"));
          await setDoc(videoDoc, {
            title,
            firmId,
            orientation,
            fileName,
            fileUrl,
            thumbnailUrl,
            isActive: true,
            expiresAt: expiry ? new Date(expiry) : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// ========== GENERATE THUMBNAIL ==========
async function generateThumbnail(file, fileName) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload  = "auto";
    video.muted    = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    let captured = false;

    const captureFrame = async () => {
      if (captured) return;
      captured = true;

      try {
        const canvas = document.createElement("canvas");
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) { reject(new Error("Canvas blob oluşturulamadı")); return; }

          try {
            const thumbFileName = "thumb_" + fileName.replace(/\.mp4$/i, ".jpg");
            const thumbRef = ref(storage, "thumbnails/" + thumbFileName);
            await uploadBytesResumable(thumbRef, blob);
            const thumbUrl = await getDownloadURL(thumbRef);
            resolve(thumbUrl);
          } catch (err) {
            reject(err);
          }
        }, "image/jpeg", 0.75);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = video.duration > 1 ? 1 : video.duration * 0.25;
    });

    video.addEventListener("seeked", captureFrame);

    // Timeout fallback if seeked never fires
    setTimeout(() => { if (!captured) captureFrame(); }, 4000);

    video.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Video yüklenemedi"));
    });
  });
}

// ========== LOAD VIDEOS ==========
async function loadVideos() {
  try {
    const videosQuery = query(collection(db, "videos"), orderBy("createdAt", "desc"));
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
      const data     = docSnap.data();
      const videoId  = docSnap.id;
      const firmName = firmsMap.get(data.firmId) || "—";
      const badgeClass     = getOrientationBadgeClass(data.orientation);
      const orientationLabel = getOrientationLabel(data.orientation);
      const expiryDisplay  = formatDate(data.expiresAt);

      const tr = document.createElement("tr");

      // Thumbnail cell
      const tdThumb = document.createElement("td");
      if (data.thumbnailUrl) {
        const img = document.createElement("img");
        img.src   = data.thumbnailUrl;
        img.alt   = data.title;
        img.className = "w-16 h-10 object-cover rounded";
        tdThumb.appendChild(img);
      } else {
        tdThumb.innerHTML = `
          <div class="w-16 h-10 bg-white/5 rounded flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
          </div>`;
      }

      // Title cell
      const tdTitle = document.createElement("td");
      tdTitle.className = "td-title";
      tdTitle.textContent = data.title;

      // Firm cell
      const tdFirm = document.createElement("td");
      tdFirm.className = "td-muted";
      tdFirm.textContent = firmName;

      // Orientation badge cell
      const tdOrientation = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge ${badgeClass}`;
      badge.textContent = orientationLabel;
      tdOrientation.appendChild(badge);

      // Expiry cell
      const tdExpiry = document.createElement("td");
      tdExpiry.className = "td-muted";
      tdExpiry.textContent = expiryDisplay;

      // Toggle cell
      const tdToggle = document.createElement("td");
      const toggle = document.createElement("div");
      toggle.className = `toggle-switch${data.isActive ? " active" : ""}`;
      toggle.dataset.id     = videoId;
      toggle.dataset.active = String(data.isActive);
      toggle.addEventListener("click", () => toggleVideo(videoId, toggle.dataset.active === "true", toggle));
      tdToggle.appendChild(toggle);

      // Delete cell
      const tdDelete = document.createElement("td");
      const btn = document.createElement("button");
      btn.className   = "px-3 py-1 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-md transition";
      btn.textContent = "Sil";
      btn.addEventListener("click", () => deleteVideo(videoId, data.fileName));
      tdDelete.appendChild(btn);

      tr.append(tdThumb, tdTitle, tdFirm, tdOrientation, tdExpiry, tdToggle, tdDelete);
      videoList.appendChild(tr);
    });
  } catch (error) {
    console.error("Videolar yüklenirken hata:", error);
    alert("Videolar yüklenemedi: " + error.message);
  }
}

// ========== TOGGLE VIDEO ==========
async function toggleVideo(videoId, currentState, toggleEl) {
  const newState = !currentState;
  // Optimistic UI update
  toggleEl.dataset.active = String(newState);
  toggleEl.classList.toggle("active", newState);

  try {
    await updateDoc(doc(db, "videos", videoId), {
      isActive: newState,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // Revert on failure
    toggleEl.dataset.active = String(currentState);
    toggleEl.classList.toggle("active", currentState);
    console.error("Video durumu güncellenirken hata:", error);
    alert("Video durumu güncellenemedi: " + error.message);
  }
}

// ========== DELETE VIDEO ==========
async function deleteVideo(videoId, fileName) {
  if (!confirm("Bu videoyu silmek istediğinize emin misiniz?")) return;

  try {
    await deleteObject(ref(storage, "videos/" + fileName));
  } catch (err) {
    console.warn("Storage'dan video silinemedi:", err);
  }

  // Try to delete thumbnail as well
  try {
    const thumbName = "thumb_" + fileName.replace(/\.mp4$/i, ".jpg");
    await deleteObject(ref(storage, "thumbnails/" + thumbName));
  } catch (_) { /* thumbnail may not exist */ }

  try {
    await deleteDoc(doc(db, "videos", videoId));
    await loadVideos();
  } catch (error) {
    console.error("Video silinirken hata:", error);
    alert("Video silinemedi: " + error.message);
  }
}

// ========== ORIENTATION HELPERS ==========
const ORIENTATION = {
  horizontal: { label: "Yatay",  badgeClass: "badge-horizontal" },
  vertical:   { label: "Dikey",  badgeClass: "badge-vertical"   },
  both:       { label: "Ortak",  badgeClass: "badge-both"       },
};

function getOrientationLabel(value) {
  return ORIENTATION[value]?.label ?? value ?? "—";
}

function getOrientationBadgeClass(value) {
  return ORIENTATION[value]?.badgeClass ?? "";
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
