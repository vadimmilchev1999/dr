// Chuẩn bị settings hoàn chỉnh
const completeSettings = this.prepareCompleteSettings(settingsToUse);
// Chuẩn bị settings hoàn chỉnh
prepareCompleteSettings(settingsToUse);
{
  const completeSettings = {
    music: settingsToUse.music || "./music/happybirtday_uia.mp3",
    countdown: settingsToUse.countdown || 3,
    matrixText: settingsToUse.matrixText || "HAPPYBIRTHDAY",
    matrixColor1: settingsToUse.matrixColor1 || "#ffb6c1",
    matrixColor2: settingsToUse.matrixColor2 || "#ffc0cb",
    sequence: settingsToUse.sequence || "HAPPY|BIRTHDAY|MY|PRINCESS|DINARA|❤",
    sequenceColor: settingsToUse.sequenceColor || "#d39b9b",
    gift: settingsToUse.gift || "",
    enableBook:
      settingsToUse.enableBook !== undefined ? settingsToUse.enableBook : true,
    enableHeart:
      settingsToUse.enableHeart !== undefined
        ? settingsToUse.enableHeart
        : true,
    isSave: settingsToUse.isSave !== undefined ? settingsToUse.isSave : true,
    pages: settingsToUse.pages || [],
  };

  return completeSettings;
}
// Hoàn thành quá trình tạo
finishCreation();
{
  // Đóng modal settings
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) {
    settingsModal.style.display = "none";
  }

  // Bắt đầu website
  if (typeof startCountdown === "function") {
    startCountdown();
  } else if (typeof startWebsite === "function") {
    startWebsite();
  }
}

getCurrentSettingsFromModal();
{
  // Kiểm tra xem modal có đang mở không
  const settingsModal = document.getElementById("settingsModal");
  if (!settingsModal || settingsModal.style.display === "none") {
    // Ngay cả khi modal đã đóng, vẫn lấy giá trị từ form nếu có thể
  }

  try {
    // Lấy settings từ modal form (ngay cả khi modal đã đóng)
    const isSaveElement = document.getElementById("isSave");
    const isSaveValue =
      isSaveElement?.checked || window.lastIsSaveState || false;

    const modalSettings = {
      music:
        document.getElementById("backgroundMusic")?.value ||
        "./music/happybirtday_uia.mp3",
      countdown: parseInt(document.getElementById("countdownTime")?.value) || 3,
      matrixText:
        document.getElementById("matrixText")?.value || "HAPPYBIRTHDAY",
      matrixColor1: document.getElementById("matrixColor1")?.value || "#ffb6c1",
      matrixColor2: document.getElementById("matrixColor2")?.value || "#ffc0cb",
      sequence:
        document.getElementById("sequenceText")?.value ||
        "HAPPY|BIRTHDAY|MY|PRINCESS|DINARA|❤",
      sequenceColor:
        document.getElementById("sequenceColor")?.value || "#d39b9b",
      gift: document.getElementById("giftImage")?.value || "",
      enableBook: document.getElementById("enableBook")?.value === "true",
      enableHeart: document.getElementById("enableHeart")?.value === "true",
      isSave: isSaveValue,
      pages: this.getPagesFromModal(),
    };

    return modalSettings;
  } catch (error) {
    console.error("❌ [DEBUG] Error in getCurrentSettingsFromModal:", error);
    return null;
  }
}

// Thêm function để lấy pages từ modal
getPagesFromModal();
{
  try {
    const pages = [];
    const modalSettings = window.settings || this.defaultSettings;

    // Lấy số lượng trang từ settings hiện tại
    const currentPages = modalSettings.pages || [];

    currentPages.forEach((page, index) => {
      const fileInput = document.getElementById(`pageImage${index}`);
      const contentInput = document.getElementById(`pageContent${index}`);

      const newPage = {};

      // Kiểm tra có file mới được chọn không
      if (fileInput && fileInput.files.length > 0) {
        // Tạo URL tạm thời cho file mới
        newPage.image = URL.createObjectURL(fileInput.files[0]);
      } else {
        // Giữ nguyên ảnh cũ
        newPage.image = page.image;
      }

      // Lấy content (chỉ với các trang có textarea)
      if (contentInput) {
        newPage.content = contentInput.value;
      } else {
        newPage.content = page.content || "";
      }

      pages.push(newPage);
    });

    return pages;
  } catch (error) {
    console.error("❌ [PAGES ERROR] Error getting pages from modal:", error);
    return window.settings?.pages || this.defaultSettings.pages || [];
  }
}

// Hiển thị section chia sẻ
showShareSection(websiteId);
{
  const shareSection = document.getElementById("shareSection");
  const shareURL = document.getElementById("shareURL");

  if (shareSection && shareURL) {
    const shareableURL = window.birthdayAPI.createShareableURL(websiteId);
    shareURL.value = shareableURL;
    shareSection.style.display = "block";

    // Hiển thị animation
    shareSection.style.animation = "slideIn 0.3s ease";
  }
}

// Tự động xóa sau 3 giây
setTimeout(() => {
  if (notification.parentNode) {
    notification.parentNode.removeChild(notification);
  }
}, 3000);

// Hiển thị progress notification
showProgressNotification(message);
{
  const notification = document.createElement("div");
  notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10005;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            background: linear-gradient(135deg, #2196f3, #64b5f6);
            display: flex;
            align-items: center;
            gap: 10px;
        `;

  notification.innerHTML = `
            <div style="
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <span>${message}</span>
        `;

  document.body.appendChild(notification);
  return notification;
}

// Cập nhật progress notification
updateProgressNotification(notification, message);
{
  if (notification) {
    const span = notification.querySelector("span");
    if (span) {
      span.textContent = message;
    }
  }
}

// Xóa progress notification
removeProgressNotification(notification);
{
  if (notification && notification.parentNode) {
    notification.parentNode.removeChild(notification);
  }
}
function startCountdown() {
  const countdown = window.settings?.countdown || 3;
  let counter = countdown;

  const countdownEl = document.createElement("div");
  countdownEl.id = "countdown";
  countdownEl.style.position = "fixed";
  countdownEl.style.top = "50%";
  countdownEl.style.left = "50%";
  countdownEl.style.transform = "translate(-50%, -50%)";
  countdownEl.style.fontSize = "72px";
  countdownEl.style.fontWeight = "bold";
  countdownEl.style.color = "#fff";
  countdownEl.style.zIndex = "10001";
  document.body.appendChild(countdownEl);

  countdownEl.textContent = counter;

  const timer = setInterval(() => {
    counter--;
    if (counter > 0) {
      countdownEl.textContent = counter;
    } else {
      clearInterval(timer);
      countdownEl.remove();
      if (typeof startWebsite === "function") {
        startWebsite(); // 🚀 Запуск основного сайта
      }
    }
  }, 1000);
}
