// WebSocket Configuration
const SOCKET_CONFIG = {
  TIMEOUT: 20000,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  PAYMENT_TIMEOUT: 300000,
};

/**
 * Socket Manager Class - Quản lý WebSocket connection
 */
class SocketManager {
  constructor() {
    this.socket = null;
    this.currentOrder = null;
    this.eventHandlers = new Map();
    this.isConnected = false;
  }

  /**
   * Khởi tạo WebSocket connection
   */
  init() {
    try {
      this.socket = io(`https://dearlove-backend.onrender.com`, {
        transports: ["websocket", "polling"],
        timeout: SOCKET_CONFIG.TIMEOUT,
        reconnection: true,
        reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
        reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS,
      });

      this._setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error("Lỗi khởi tạo WebSocket:", error);
      return null;
    }
  }

  /**
   * Thiết lập event listeners
   */
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.isConnected = true;
      this._handleReconnection();
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("🔌 WebSocket connection error:", error);
      this.isConnected = false;
    });
  }

  /**
   * Xử lý kết nối lại khi reconnect
   */
  _handleReconnection() {
    const currentOrderCode = localStorage.getItem("current_order_code");
    const isPaymentInProgress =
      localStorage.getItem("payment_in_progress") === "true";

    if (currentOrderCode && isPaymentInProgress) {
      this.joinOrder(currentOrderCode);
    }
  }

  /**
   * Join vào room theo dõi order
   */
  joinOrder(orderCode) {
    if (!this.socket || !this.isConnected) {
      console.error("❌ Socket chưa kết nối");
      return false;
    }

    // Leave room cũ nếu có
    if (this.currentOrder && this.currentOrder !== orderCode) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.emit("join-order", orderCode);
    this.currentOrder = orderCode;
    return true;
  }

  /**
   * Leave khỏi room
   */
  leaveOrder(orderCode) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit("leave-order", orderCode);
    if (this.currentOrder === orderCode) {
      this.currentOrder = null;
    }
  }

  /**
   * Đăng ký event handler với cleanup
   */
  on(event, handler) {
    if (!this.socket) return;

    // Lưu handler để có thể remove sau
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);

    this.socket.on(event, handler);
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (!this.socket) return;

    this.socket.off(event, handler);

    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Cleanup tất cả event handlers
   */
  cleanup() {
    if (!this.socket) return;

    // Remove tất cả event handlers
    for (const [event, handlers] of this.eventHandlers) {
      handlers.forEach((handler) => {
        this.socket.off(event, handler);
      });
    }
    this.eventHandlers.clear();

    // Leave current order
    if (this.currentOrder) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.disconnect();
    this.socket = null;
    this.currentOrder = null;
    this.isConnected = false;
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isSocketConnected() {
    return this.socket && this.isConnected;
  }
}

// Tạo instance global
const socketManager = new SocketManager();

/**
 * Khởi tạo WebSocket connection
 */
function initWebSocket() {
  const socket = socketManager.init();

  // Lưu reference cho backward compatibility
  window.socket = socketManager.socket;

  return socket;
}

/**
 * Cleanup payment state
 */
function cleanupPaymentState(orderCode, showError = false) {
  localStorage.removeItem("payment_in_progress");
  localStorage.removeItem("current_order_code");

  if (socketManager.currentOrder === orderCode) {
    socketManager.leaveOrder(orderCode);
  }
}

// Khai báo global types để tránh TypeScript errors
if (typeof window !== "undefined") {
  window.socketManager = socketManager;
  window.initWebSocket = initWebSocket;
  window.cleanupPaymentState = cleanupPaymentState;
}

class PricingCalculator {
  constructor() {
    this.basePrices = {};

    this.defaultSettings = {
      music: "./music/happy-birthdfay.mp3",
      enableBook: true,
      enableHeart: true,
      isSave: true,
      pages: [],
    };
    this.selectedVoucher = null;
    this.vouchers = [];
    this.createPricingUI();
    this.initializeVoucherSystem(); // ✅ Thêm dòng này
    this.updatePricing();
  }

  // Xử lý tạo free
  async handleFreeCreation() {
    try {
      // Log trước khi tạo

      // Lấy settings
      let settingsToUse =
        this.getCurrentSettingsFromModal() ||
        window.settings ||
        this.defaultSettings;

      // Validate trang sách
      if (settingsToUse.enableBook) {
        const totalPages = settingsToUse.pages?.length || 0;
        if (totalPages > 1 && totalPages % 2 === 0) {
          this.showNotification(
            `❌ Cấu trúc trang không hợp lệ! Hiện tại có ${totalPages} trang. Vui lòng thêm hoặc xóa 1 trang để tạo cấu trúc hợp lệ.`,
            "error"
          );
          return;
        }
      }

      // Tạo orderCode unique
      const orderCode = this.generateOrderCode();

      // Hiển thị progress
      let progressNotification = null;
      if (settingsToUse.enableBook && settingsToUse.pages?.length > 0) {
        progressNotification = this.showProgressNotification(
          "📤 Đang upload ảnh trang sách..."
        );
      }

      // Chuẩn bị settings hoàn chỉnh
      const completeSettings = this.prepareCompleteSettings(settingsToUse);

      // Cập nhật progress
      if (progressNotification) {
        this.updateProgressNotification(
          progressNotification,
          "🌐 Đang tạo website..."
        );
      }

      // Tạo website
      const websiteResult = await window.birthdayAPI.createBirthdayWebsite(
        completeSettings,
        "Free"
      );

      if (!websiteResult.success) {
        throw new Error(websiteResult.error || "Không thể tạo website");
      }

      // Tạo sản phẩm
      if (progressNotification) {
        this.updateProgressNotification(
          progressNotification,
          "📦 Đang tạo sản phẩm..."
        );
      }

      const productData = this.createProductData(
        websiteResult.websiteId,
        orderCode,
        "FREE",
        0
      );
      const productResult = await this.createProduct(productData);

      // Xử lý voucher nếu có (cho cả FREE)
      if (this.selectedVoucher) {
        if (progressNotification) {
          this.updateProgressNotification(
            progressNotification,
            "🎫 Đang áp dụng voucher..."
          );
        }
        await this.applyVoucher(orderCode);
      }

      // Xóa progress
      if (progressNotification) {
        this.removeProgressNotification(progressNotification);
      }

      // Hiển thị kết quả thành công
      this.showSuccessResult(websiteResult.websiteId, 0);

      // Đóng modal và bắt đầu website
      this.finishCreation();
    } catch (error) {
      console.error("❌ [CATCH ERROR] Error creating website:", error);
      console.error("❌ [CATCH ERROR] Error stack:", error.stack);
      this.showNotification(
        "❌ Lỗi khi tạo website: " + error.message,
        "error"
      );
    }
  }

  // ✅ Thêm hàm xử lý thanh toán
  async handlePaidCreation() {
    try {
      // Lấy settings
      let settingsToUse =
        this.getCurrentSettingsFromModal() ||
        window.settings ||
        this.defaultSettings;

      // Ưu tiên sử dụng trạng thái checkbox đã lưu
      if (window.lastIsSaveState !== undefined) {
        settingsToUse.isSave = window.lastIsSaveState;
      }

      // Validate trang sách
      if (settingsToUse.enableBook) {
        const totalPages = settingsToUse.pages?.length || 0;
        if (totalPages > 1 && totalPages % 2 === 0) {
          this.showNotification(
            `❌ Cấu trúc trang không hợp lệ! Hiện tại có ${totalPages} trang. Vui lòng thêm hoặc xóa 1 trang để tạo cấu trúc hợp lệ.`,
            "error"
          );
          return;
        }
      }

      // Tạo orderCode unique
      const orderCode = this.generateOrderCode();

      // Hiển thị progress
      let progressNotification = null;
      if (settingsToUse.enableBook && settingsToUse.pages?.length > 0) {
        progressNotification = this.showProgressNotification(
          "📤 Đang upload ảnh trang sách..."
        );
      }

      // Chuẩn bị settings hoàn chỉnh
      const completeSettings = this.prepareCompleteSettings(settingsToUse);

      // Cập nhật progress
      if (progressNotification) {
        this.updateProgressNotification(
          progressNotification,
          "🌐 Đang tạo website..."
        );
      }

      // Tạo website
      const websiteResult = await window.birthdayAPI.createBirthdayWebsite(
        completeSettings,
        "PAID"
      );

      if (!websiteResult.success) {
        throw new Error(websiteResult.error || "Không thể tạo website");
      }

      // Tạo sản phẩm với status PENDING
      if (progressNotification) {
        this.updateProgressNotification(
          progressNotification,
          "📦 Đang tạo sản phẩm..."
        );
      }

      const productData = this.createProductData(
        websiteResult.websiteId,
        orderCode,
        "PENDING",
        this.originalTotal
      );
      const productResult = await this.createProduct(productData);

      // Xử lý voucher nếu có
      let finalPrice = this.originalTotal;
      if (this.selectedVoucher) {
        if (progressNotification) {
          this.updateProgressNotification(
            progressNotification,
            "🎫 Đang áp dụng voucher..."
          );
        }
        try {
          await this.applyVoucher(orderCode);
          finalPrice = this.currentTotal; // Giá sau khi áp dụng voucher
        } catch (error) {
          console.error("Lỗi áp dụng voucher:", error);
          this.showNotification(
            "⚠️ Lỗi áp dụng voucher, tiếp tục thanh toán với giá gốc",
            "warning"
          );
        }
      }

      // Xóa progress
      if (progressNotification) {
        this.removeProgressNotification(progressNotification);
      }

      // Xử lý thanh toán
      if (finalPrice > 0) {
        const paymentMethod = this.getSelectedPaymentMethod();
        await this.processPayment(
          orderCode,
          finalPrice,
          websiteResult.websiteId,
          paymentMethod
        );
      } else {
        // Trường hợp voucher làm giá = 0
        this.showSuccessResult(websiteResult.websiteId, 0);
        this.finishCreation();
      }
    } catch (error) {
      console.error("❌ [PAID CATCH] Error in paid creation:", error);
      this.showNotification("❌ Lỗi thanh toán: " + error.message, "error");
    }
  }

  // Tạo orderCode unique
  generateOrderCode() {
    const firstDigit = Math.floor(1 + Math.random() * 9);
    const orderCode =
      firstDigit.toString() +
      Date.now().toString().slice(-8) +
      Math.floor(100 + Math.random() * 900);
    return orderCode;
  }

  // Chuẩn bị settings hoàn chỉnh
  prepareCompleteSettings(settingsToUse) {
    const completeSettings = {
      music: settingsToUse.music || "./music/happybirtday_uia.mp3",
      countdown: settingsToUse.countdown || 3,
      matrixText: settingsToUse.matrixText || "HAPPYBIRTHDAY❤",
      matrixColor1: settingsToUse.matrixColor1 || "#ffb6c1",
      matrixColor2: settingsToUse.matrixColor2 || "#ffc0cb",
      sequence:
        settingsToUse.sequence || "HAPPY|BIRTHDAY|MY|CUTEE|LITTLE|SWARALI|❤",
      sequenceColor: settingsToUse.sequenceColor || "#d39b9b",
      gift: settingsToUse.gift || "",
      enableBook:
        settingsToUse.enableBook !== undefined
          ? settingsToUse.enableBook
          : false,
      enableHeart:
        settingsToUse.enableHeart !== undefined
          ? settingsToUse.enableHeart
          : false,
      isSave: settingsToUse.isSave !== undefined ? settingsToUse.isSave : false,
      pages: settingsToUse.pages || [],
    };

    return completeSettings;
  }

  // Tạo dữ liệu sản phẩm
  createProductData(websiteId, orderCode, status, price) {
    const userUid = localStorage.getItem("user_uid");
    const productLink =
      window.location.origin +
      window.location.pathname +
      "?websiteId=" +
      websiteId;

    return {
      uid: userUid,
      orderCode: orderCode.toString(),
      name: "Birthday Website",
      type: "Birthday",
      price: price,
      images:
        "https://cdn.deargift.online/uploads/Screenshot%202025-07-08%20123133.png",
      linkproduct: productLink,
      configId: websiteId,
      status: status,
      createdAt: new Date(),
    };
  }

  // Tạo sản phẩm
  async createProduct(productData) {
    try {
      const res = await fetch(
        "https://dearlove-backend.onrender.com/api/products",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productData),
        }
      );

      const data = await res.json();
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || "Lỗi khi tạo sản phẩm");
      }
    } catch (error) {
      throw new Error("Lỗi khi tạo sản phẩm: " + error.message);
    }
  }

  // Áp dụng voucher
  async applyVoucher(orderCode) {
    try {
      const userUid = localStorage.getItem("user_uid");
      const voucherRes = await fetch(
        "https://dearlove-backend.onrender.com/api/vouchers/apply",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: userUid,
            code: this.selectedVoucher.code,
            orderCode: orderCode.toString(),
          }),
        }
      );

      const voucherData = await voucherRes.json();
      if (!voucherData.success) {
        throw new Error(voucherData.message || "Áp dụng voucher thất bại!");
      }

      this.showNotification("✅ Áp dụng voucher thành công!", "success");
      return voucherData;
    } catch (error) {
      console.error("❌ [VOUCHER] Error applying voucher:", error);
      throw error;
    }
  }

  // Xử lý thanh toán
  async processPayment(orderCode, amount, websiteId, paymentMethod = "PAYOS") {
    try {
      const userUid = localStorage.getItem("user_uid");
      const customerEmail = localStorage.getItem("user_email") || "";

      // Tính toán amount cho PayPal bao gồm tip
      let finalAmount = amount;
      if (paymentMethod === "PAYPAL") {
        const basePayPalAmount = 5; // Base amount for PayPal
        const tipInput = document.getElementById("tipAmount");
        const tipAmount = tipInput ? parseInt(tipInput.value) || 0 : 0;
        const tipInUSD = tipAmount > 0 ? tipAmount : 0; // Tip trực tiếp như USD, không cần chuyển đổi
        finalAmount = basePayPalAmount + tipInUSD;
      }

      const paymentData = {
        amount: finalAmount,
        description: "Birthday Website",
        orderCode: Number(orderCode),
        uid: userUid,
        customerEmail: customerEmail,
        paymentMethod: paymentMethod, // Thêm phương thức thanh toán
      };
      // Lưu orderCode vào localStorage để WebSocket có thể sử dụng
      localStorage.setItem("current_order_code", orderCode);

      const paymentMethodText = paymentMethod === "PAYPAL" ? "PAYPAL" : "PAYOS";
      this.showNotification(
        `🔄 Đang chuyển đến trang thanh toán ${paymentMethodText}...`,
        "info"
      );

      const paymentRes = await fetch(
        "https://dearlove-backend.onrender.com/api/payment/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentData),
        }
      );

      const paymentResult = await paymentRes.json();

      // Xử lý đơn cũ - cập nhật orderCode nếu backend trả về đơn cũ
      if (
        paymentResult.data?.isExistingOrder &&
        paymentResult.data?.orderCode
      ) {
        const oldOrderCode = paymentResult.data.orderCode;

        // Cập nhật orderCode trong localStorage
        localStorage.setItem("current_order_code", oldOrderCode);

        // Cập nhật orderCode để sử dụng cho WebSocket
        orderCode = oldOrderCode;
      }

      // Xử lý response theo paymentMethod
      let checkoutUrl = "";
      if (paymentMethod === "PAYPAL") {
        // PayPal trả về data.checkoutUrl
        checkoutUrl = paymentResult.data?.checkoutUrl;
      } else {
        // PayOS trả về checkoutUrl trực tiếp
        checkoutUrl =
          paymentResult.data?.checkoutUrl || paymentResult.checkoutUrl;
      }

      if (!checkoutUrl) {
        throw new Error("Không nhận được URL thanh toán");
      }

      // Hiển thị thanh toán theo phương thức
      if (paymentMethod === "PAYPAL") {
        // PayPal: Mở trong tab mới
        this.showPayPalPayment(checkoutUrl, websiteId, amount);
      } else {
        // PayOS: Hiển thị trong iframe
        this.showPaymentModal(checkoutUrl, websiteId, amount);
      }
    } catch (error) {
      throw new Error("Lỗi xử lý thanh toán: " + error.message);
    }
  }

  showPaymentModal(checkoutUrl, websiteId, amount) {
    let paymentModal = document.getElementById("paymentModal");
    if (!paymentModal) {
      paymentModal = document.createElement("div");
      paymentModal.id = "paymentModal";
      paymentModal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        `;

      paymentModal.innerHTML = `
            <div style="position:relative; margin: 5% auto; width: 90%; max-width: 800px; background:white; padding:20px; border-radius:10px;">
                <button id="paymentModalClose" style="position:absolute;top:10px;right:10px;">✖</button>
                <iframe id="paymentIframe" style="width:100%; height:600px; border:none;"></iframe>
            </div>
        `;

      document.body.appendChild(paymentModal);
    }

    // Đảm bảo nút đóng và iframe luôn tồn tại
    const closeBtn = paymentModal.querySelector("#paymentModalClose");
    const iframe = paymentModal.querySelector("#paymentIframe");
    if (iframe) iframe.src = checkoutUrl;
    paymentModal.style.display = "block";

    if (closeBtn) {
      closeBtn.onclick = () => {
        paymentModal.style.display = "none";
      };
    }

    // Khởi tạo WebSocket nếu chưa có
    if (!window.socketManager || !window.socketManager.isSocketConnected()) {
      window.initWebSocket();
    }

    // Lấy orderCode từ localStorage hoặc tạo mới
    const orderCode =
      localStorage.getItem("current_order_code") || this.generateOrderCode();

    // Set flag đang trong quá trình thanh toán
    localStorage.setItem("payment_in_progress", "true");
    localStorage.setItem("current_order_code", orderCode);

    // Lắng nghe kết quả thanh toán
    return new Promise((resolve, reject) => {
      let iframeLoaded = false;
      let wsMessageReceived = false;

      // Hàm kiểm tra và xử lý kết quả
      const checkAndProcessResult = () => {
        if (iframeLoaded && wsMessageReceived) {
          // Cả iframe và WebSocket đều sẵn sàng
        }
      };

      // Set iframe events cho PAYOS
      iframe.onload = () => {
        iframeLoaded = true;
        checkAndProcessResult();
      };

      iframe.onerror = () => {};

      iframe.onbeforeunload = () => {};

      // Lắng nghe WebSocket event cho PAYOS
      if (window.socketManager && window.socketManager.isSocketConnected()) {
        window.socketManager.joinOrder(orderCode);

        const paymentStatusHandler = (data) => {
          if (String(data.orderCode) === String(orderCode)) {
            wsMessageReceived = true;

            if (data.status === "PAID") {
              window.cleanupPaymentState(orderCode, false);
              paymentModal.style.display = "none";
              this.showSuccessResult(websiteId, amount);
              this.finishCreation();
              window.socketManager.off(
                "payment_status_update",
                paymentStatusHandler
              );
              resolve();
            } else if (data.status === "CANCELLED") {
              window.cleanupPaymentState(orderCode, false);
              paymentModal.style.display = "none";
              this.showNotification("Thanh toán đã bị hủy", "warning");
              window.socketManager.off(
                "payment_status_update",
                paymentStatusHandler
              );
              reject(new Error("Thanh toán bị hủy"));
            } else if (data.status === "failed") {
              window.cleanupPaymentState(orderCode, false);
              paymentModal.style.display = "none";
              this.showNotification(
                "❌ Thanh toán thất bại. Vui lòng thử lại.",
                "error"
              );
              window.socketManager.off(
                "payment_status_update",
                paymentStatusHandler
              );
              reject(new Error(data.message || "Thanh toán thất bại!"));
            }
          } else {
          }
        };

        window.socketManager.on("payment_status_update", paymentStatusHandler);
      } else {
        console.error("❌ WebSocket chưa được khởi tạo!");
        reject(new Error("WebSocket connection error!"));
      }

      // Fallback: Timeout sau 5 phút
      setTimeout(() => {
        if (!wsMessageReceived) {
          window.cleanupPaymentState(orderCode, false);
          this.showNotification(
            "Timeout - Không thể xác định trạng thái thanh toán!",
            "warning"
          );
          reject(
            new Error("Timeout - Không thể xác định trạng thái thanh toán!")
          );
        }
      }, 300000); // 5 phút
    });
  }

  showPayPalPayment(checkoutUrl, websiteId, amount) {
    // PayPal: Điều hướng trực tiếp thay vì popup

    // Lấy orderCode từ localStorage hoặc tạo mới
    const orderCode =
      localStorage.getItem("current_order_code") || this.generateOrderCode();

    // Set flag đang trong quá trình thanh toán
    localStorage.setItem("payment_in_progress", "true");
    localStorage.setItem("current_order_code", orderCode);

    // Cleanup socket state trước khi điều hướng
    if (window.socketManager) {
      // Leave current order nếu có
      if (window.socketManager.currentOrder) {
        window.socketManager.leaveOrder(window.socketManager.currentOrder);
      }

      // Cleanup tất cả event handlers
      window.socketManager.cleanup();
    }

    // Hiển thị thông báo trước khi điều hướng
    this.showNotification(
      "🔄 Đang chuyển đến trang thanh toán PayPal...",
      "info"
    );

    // Điều hướng trực tiếp đến trang PayPal
    window.location.href = checkoutUrl;
  }

  showSuccessResult(websiteId, price) {
    const shareableURL = window.birthdayAPI.createShareableURL(websiteId);

    // Lấy payment method để hiển thị đúng đơn vị tiền tệ
    const selectedPaymentMethod = this.getSelectedPaymentMethod();
    let priceText;

    if (price > 0) {
      if (selectedPaymentMethod === "PAYPAL") {
        // PayPal: Tính tổng tiền bao gồm tip (base $5 + tip trực tiếp như USD)
        const basePayPalAmount = 5; // Base amount for PayPal
        const tipInput = document.getElementById("tipAmount");
        const tipAmount = tipInput ? parseInt(tipInput.value) || 0 : 0;
        const tipInUSD = tipAmount > 0 ? tipAmount : 0; // Tip trực tiếp như USD, không cần chuyển đổi
        const totalPayPalAmount = basePayPalAmount + tipInUSD;
        priceText = `<span style="color:#6c63ff;font-weight:bold;">${this.formatPriceUSD(
          totalPayPalAmount
        )}</span>`;
      } else {
        // PayOS: Hiển thị giá VND
        priceText = `<span style="color:#6c63ff;font-weight:bold;">${price.toLocaleString()} VNĐ</span>`;
      }
    } else {
      priceText = `<span style="color:#4caf50;font-weight:bold;">${t(
        "free"
      )}</span>`;
    }

    // Hiển thị thông báo thành công
    this.showNotification("🎉 Tạo website thành công!", "success");

    // Hiển thị section chia sẻ
    this.showShareSection(websiteId);

    // Tạo notification với thông tin chi tiết
    const successNotification = document.createElement("div");
    successNotification.className = "success-notification-popup";
    successNotification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10006;
        max-width: 400px;
        text-align: center;
    `;

    successNotification.innerHTML = `
    <h3 style="color: #4caf50; margin-bottom: 15px;">${t("createSuccess")}</h3>
    <div style="margin-bottom: 15px;">
        <strong>${t("price")}</strong> ${priceText}
    </div>
    <div style="margin-bottom: 15px;">
        <strong>${t("shareLink")}</strong>
        <div style="
            background: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            word-break: break-all;
            font-size: 12px;
            margin-top: 5px;
        ">${shareableURL}</div>
    </div>
    <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="copySuccessLinkBtn" style="
            background: #2196f3;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
        ">${t("copyLink")}</button>
        <button id="openSuccessLinkBtn" style="
            background: #4caf50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
        ">${t("viewWebsite")}</button>
          <button id="heartQrBtn" style="
        background: #ff4081;
        color: #fff;
       padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
    ">${t("heartQr")}</button>
        <button id="closeSuccessNotificationBtn" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
        ">${t("close")}</button>
       
    </div>
    <div style="margin-top: 22px; padding: 14px 10px 8px 10px; background: linear-gradient(90deg,#f9fafc,#f3e7fa 70%); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <img src="https://cdn-icons-png.flaticon.com/512/3046/3046125.png" alt="TikTok" style="width:28px;height:28px;">
            <span style="font-size: 15px; color: #222; font-weight: 500;">
                ${t("thanks")}
            </span>
        </div>
        <a href="https://www.tiktok.com/@iamtritoan?is_from_webapp=1&sender_device=pc" target="_blank" style="
            display: inline-block;
            margin-top: 4px;
            background: linear-gradient(90deg,#ff0050,#00f2ea 80%);
            color: #fff;
            font-weight: bold;
            padding: 8px 18px;
            border-radius: 30px;
            text-decoration: none;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transition: background 0.2s;
        " onmouseover="this.style.background='#00f2ea'" onmouseout="this.style.background='linear-gradient(90deg,#ff0050,#00f2ea 80%)'">
            ${t("tiktokBtn")}
        </a>
    </div>
   
`;
    // ...existing code...

    // Sau khi gán innerHTML, thêm sự kiện cho nút QR
    const heartQrBtn = successNotification.querySelector("#heartQrBtn");
    if (heartQrBtn) {
      heartQrBtn.onclick = () => {
        navigator.clipboard
          .writeText(shareableURL)
          .then(() => {
            this.showNotification(t("heartQrCopy"), "success");
            window.open("https://deargift.online/heartqr.html", "_blank");
          })
          .catch(() => {
            window.open("https://deargift.online/heartqr.html", "_blank");
          });
      };
    }

    document.body.appendChild(successNotification);

    // Gán sự kiện cho các nút
    const copyBtn = successNotification.querySelector("#copySuccessLinkBtn");
    const openBtn = successNotification.querySelector("#openSuccessLinkBtn");
    const closeBtn = successNotification.querySelector(
      "#closeSuccessNotificationBtn"
    );
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(shareableURL).then(() => {
          this.showNotification(t("copySuccess"), "success");
        });
      };
    }
    if (openBtn) {
      openBtn.onclick = () => {
        window.open(shareableURL, "_blank");
      };
    }
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (successNotification.parentNode) {
          successNotification.parentNode.removeChild(successNotification);
        }
      };
    }
  }

  // Hoàn thành quá trình tạo
  finishCreation() {
    // Đóng modal settings
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.display = "none";
    }

    // Bắt đầu website
    if (typeof startWebsite === "function") {
      startWebsite();
    }
  }

  getCurrentSettingsFromModal() {
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
        countdown:
          parseInt(document.getElementById("countdownTime")?.value) || 3,
        matrixText:
          document.getElementById("matrixText")?.value || "HAPPYBIRTHDAY❤",
        matrixColor1:
          document.getElementById("matrixColor1")?.value || "#ffb6c1",
        matrixColor2:
          document.getElementById("matrixColor2")?.value || "#ffc0cb",
        sequence:
          document.getElementById("sequenceText")?.value ||
          "HAPPY|BIRTHDAY|MY|CUTEE|LITTLE|SWARALI|❤",
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
  getPagesFromModal() {
    try {
      const pages = [9];
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
  showShareSection(websiteId) {
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

  // Sao chép URL chia sẻ
  copyShareURL() {
    const shareURL = document.getElementById("shareURL");
    const copyButton = document.getElementById("copyButton");

    if (shareURL) {
      shareURL.select();
      shareURL.setSelectionRange(0, 99999); // For mobile devices

      try {
        navigator.clipboard
          .writeText(shareURL.value)
          .then(() => {
            copyButton.textContent = "✅ Đã sao chép!";
            this.showNotification(
              "📋 Đã sao chép link vào clipboard!",
              "success"
            );
            setTimeout(() => {
              copyButton.textContent = "📋 Sao chép link";
            }, 2000);
          })
          .catch(() => {
            // Fallback for older browsers
            document.execCommand("copy");
            copyButton.textContent = "✅ Đã sao chép!";
            this.showNotification(
              "📋 Đã sao chép link vào clipboard!",
              "success"
            );
            setTimeout(() => {
              copyButton.textContent = "📋 Sao chép link";
            }, 2000);
          });
      } catch (err) {
        console.error("Copy failed:", err);
        this.showNotification("❌ Không thể sao chép link!", "error");
      }
    }
  }

  // Hiển thị thông báo
  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 9999990004;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        `;

    switch (type) {
      case "success":
        notification.style.background =
          "linear-gradient(135deg, #4caf50, #66bb6a)";
        break;
      case "error":
        notification.style.background =
          "linear-gradient(135deg, #f44336, #e57373)";
        break;
      default:
        notification.style.background =
          "linear-gradient(135deg, #2196f3, #64b5f6)";
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Phương thức để cập nhật giá từ bên ngoài
  updateFromSettings(newSettings) {
    this.updatePricing(newSettings);
  }

  // Hiển thị progress notification
  showProgressNotification(message) {
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
  updateProgressNotification(notification, message) {
    if (notification) {
      const span = notification.querySelector("span");
      if (span) {
        span.textContent = message;
      }
    }
  }

  // Xóa progress notification
  removeProgressNotification(notification) {
    if (notification && notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }
}

// Khởi tạo calculator sau khi DOM ready
let pricingCalculator;
// Khởi tạo nếu chưa có
// if (!window.pricingCalculator) window.initializePricingCalculator();
// window.birthdayAPI = window.birthdayAPI || {};
// window.birthdayAPI.createShareableURL = (id) => 'https://deargift.online/?websiteId=' + id;

// window.pricingCalculator.showSuccessResult('test123', 0);
// Hàm khởi tạo pricing calculator
function initializePricingCalculator() {
  if (!pricingCalculator) {
    pricingCalculator = new PricingCalculator();
    window.pricingCalculator = pricingCalculator;
  }
}

// Export cho việc sử dụng global
window.initializePricingCalculator = initializePricingCalculator;

// Ẩn settings hint sau 3 giây
document.addEventListener("DOMContentLoaded", function () {
  const settingsHint = document.getElementById("settingsHint");
  if (settingsHint) {
    setTimeout(() => {
      settingsHint.style.display = "none";
    }, 3000);
  }

  // Khởi tạo WebSocket connection
  if (window.initWebSocket) {
    window.initWebSocket();

    // Kiểm tra và tự động join lại order room nếu có payment đang pending
    const currentOrderCode = localStorage.getItem("current_order_code");
    const isPaymentInProgress =
      localStorage.getItem("payment_in_progress") === "true";

    if (currentOrderCode && isPaymentInProgress && window.socketManager) {
      // Đợi WebSocket kết nối xong rồi mới join
      setTimeout(() => {
        if (window.socketManager.isSocketConnected()) {
          window.socketManager.joinOrder(currentOrderCode);

          // Đăng ký listener cho payment status update
          window.socketManager.on("payment_status_update", (data) => {
            if (data.status === "PAID" && data.orderCode === currentOrderCode) {
              // Cleanup payment state
              window.cleanupPaymentState(currentOrderCode);

              // Hiển thị kết quả thành công
              if (window.pricingCalculator) {
                window.pricingCalculator.showSuccessResult(
                  data.websiteId || "unknown",
                  data.amount || 0
                );
              }
            }
          });
        } else {
          setTimeout(() => {
            if (window.socketManager.isSocketConnected()) {
              window.socketManager.joinOrder(currentOrderCode);
            }
          }, 2000);
        }
      }, 1000);
    }
  }
});
