class BirthdayAPI {
  constructor(baseUrl = "https://dearlove-backend.onrender.com/api") {
    this.baseUrl = baseUrl;
    this.currentWebsiteId = null;
  }

  /**
   * Конвертирует файл в base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Загрузка картинки в R2 (Cloudflare storage)
   */
  async uploadImageToR2(base64, prefix = "birthday") {
    try {
      const res = await fetch(`${this.baseUrl}/r2/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, prefix }),
      });

      const data = await res.json();
      if (!data.success)
        throw new Error(data.message || "Ошибка загрузки изображения");
      return data.url;
    } catch (err) {
      console.error("❌ Ошибка uploadImageToR2:", err);
      throw err;
    }
  }

  /**
   * Загружает картинки страниц (если они blob/base64)
   */
  async uploadPagesImages(pages) {
    const updated = [];
    for (const page of pages) {
      let newPage = { ...page };
      if (
        newPage.image &&
        (newPage.image.startsWith("blob:") || newPage.image.startsWith("data:"))
      ) {
        const base64 = newPage.image.startsWith("blob:")
          ? await this.fileToBase64(await (await fetch(newPage.image)).blob())
          : newPage.image;

        newPage.image = await this.uploadImageToR2(base64);
      }
      updated.push(newPage);
    }
    return updated;
  }

  /**
   * Проверяет input file и заливает новые картинки
   */
  async processFileInputImages(pages) {
    const updated = [];
    for (let i = 0; i < pages.length; i++) {
      const page = { ...pages[i] };
      const input = document.getElementById(`pageImage${i}`);
      if (input && input.files.length > 0) {
        const base64 = await this.fileToBase64(input.files[0]);
        page.image = await this.uploadImageToR2(base64);
      }
      updated.push(page);
    }
    return updated;
  }

  /**
   * Создание сайта
   */
  async createBirthdayWebsite(settings, status = "Free") {
    try {
      let processedSettings = { ...settings };

      // обработка страниц книги
      if (processedSettings.enableBook && processedSettings.pages?.length > 0) {
        processedSettings.pages = await this.processFileInputImages(
          processedSettings.pages
        );
        processedSettings.pages = await this.uploadPagesImages(
          processedSettings.pages
        );
      }

      const res = await fetch(`${this.baseUrl}/birthday/birthday-websites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: processedSettings, status }),
      });

      const data = await res.json();
      if (!data.success)
        throw new Error(data.message || "Ошибка при создании сайта");

      this.currentWebsiteId = data.data._id;
      localStorage.setItem("current_websiteId", this.currentWebsiteId);

      return {
        success: true,
        data: data.data,
        websiteId: this.currentWebsiteId,
      };
    } catch (err) {
      console.error("❌ Ошибка createBirthdayWebsite:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Получить сайт по ID
   */
  async getBirthdayWebsiteByWebsiteId(websiteId) {
    try {
      const res = await fetch(
        `${this.baseUrl}/birthday/birthday-websites/website/${websiteId}`
      );
      return await res.json();
    } catch (err) {
      console.error("❌ Ошибка getBirthdayWebsiteByWebsiteId:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Создать шаринг-ссылку
   */
  createShareableURL(websiteId) {
    return `${window.location.origin}${window.location.pathname}?websiteId=${websiteId}`;
  }

  /**
   * Вытянуть websiteId из URL
   */
  getWebsiteIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("websiteId");
  }

  /**
   * Получить текущий websiteId (из памяти или localStorage)
   */
  getCurrentWebsiteId() {
    return this.currentWebsiteId || localStorage.getItem("current_websiteId");
  }

  /**
   * Очистить сохраненный websiteId
   */
  clearWebsiteId() {
    this.currentWebsiteId = null;
    localStorage.removeItem("current_websiteId");
  }
}

// Делаем глобально доступным
window.birthdayAPI = new BirthdayAPI();
