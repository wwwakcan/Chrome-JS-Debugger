(function() {
  // JsDebugger - Chrome konsoluna yapıştırılabilir debug yardımcısı
  const jsDebug = {
    version: '1.0.0',
    
    // Renkli konsol çıktısı
    colors: {
      info: 'color: #0066ff; font-weight: bold',
      success: 'color: #00cc00; font-weight: bold',
      warning: 'color: #ff9900; font-weight: bold',
      error: 'color: #ff0000; font-weight: bold',
      trace: 'color: #9900cc; font-weight: normal'
    },
    
    // Değişkenleri izle
    watch: function(variableName, interval = 1000) {
      if (typeof window[variableName] === 'undefined') {
        console.warn(`%c[Debug] Değişken bulunamadı: ${variableName}`, this.colors.warning);
        return false;
      }
      
      console.log(`%c[Debug] İzleniyor: ${variableName}`, this.colors.info);
      
      const watchId = setInterval(() => {
        console.log(`%c[Değişken] ${variableName} = ${JSON.stringify(window[variableName])}`, this.colors.trace);
      }, interval);
      
      return watchId; // Durdurma için clearInterval(watchId) kullanılabilir
    },
    
    // Hata toplama
    catchErrors: function() {
      window.addEventListener('error', (event) => {
        console.error(`%c[Hata Yakalandı] ${event.message}`, this.colors.error);
        console.error('Dosya:', event.filename);
        console.error('Satır:', event.lineno, 'Sütun:', event.colno);
        console.error('Stack:', event.error?.stack);
        return false; // Hatanın normal işlenmesine izin ver
      });
      
      console.log(`%c[Debug] Hata yakalayıcı aktif edildi`, this.colors.success);
    },
    
    // Fonksiyon izleme 
    traceFunction: function(objectName, functionName) {
      if (typeof window[objectName] !== 'object' || typeof window[objectName][functionName] !== 'function') {
        console.warn(`%c[Debug] Fonksiyon bulunamadı: ${objectName}.${functionName}`, this.colors.warning);
        return false;
      }
      
      const originalFn = window[objectName][functionName];
      
      window[objectName][functionName] = function() {
        console.log(`%c[Çağrı] ${objectName}.${functionName}() çağrıldı`, jsDebug.colors.info);
        console.log('Argümanlar:', [...arguments]);
        
        const startTime = performance.now();
        const result = originalFn.apply(this, arguments);
        const endTime = performance.now();
        
        console.log(`%c[Dönüş] ${objectName}.${functionName}() sonucu:`, jsDebug.colors.success, result);
        console.log(`%c[Süre] ${(endTime - startTime).toFixed(2)}ms`, jsDebug.colors.trace);
        
        return result;
      };
      
      console.log(`%c[Debug] Fonksiyon izleme aktif: ${objectName}.${functionName}()`, this.colors.success);
      return true;
    },
    
    // Event dinleyici sayısını kontrol et (bellek sızıntısı kontrolü)
    checkEventListeners: function() {
      const elements = document.querySelectorAll('*');
      const elementsWithManyListeners = [];
      
      elements.forEach(el => {
        // getEventListeners sadece devtools konsolunda çalışır
        if (typeof getEventListeners === 'function') {
          const listeners = getEventListeners(el);
          const totalEvents = Object.values(listeners).reduce((sum, list) => sum + list.length, 0);
          
          if (totalEvents > 3) { // 3'ten fazla listener varsa uyar
            elementsWithManyListeners.push({
              element: el,
              selector: this.getSelector(el),
              listenerCount: totalEvents,
              listeners: listeners
            });
          }
        }
      });
      
      console.log(`%c[Debug] Event Listener Kontrolü Tamamlandı`, this.colors.info);
      if (elementsWithManyListeners.length > 0) {
        console.warn(`%c[Uyarı] ${elementsWithManyListeners.length} element birden fazla event listener içeriyor:`, this.colors.warning);
        console.table(elementsWithManyListeners);
      } else {
        console.log(`%c[İyi] Hiçbir element fazla listener içermiyor.`, this.colors.success);
      }
    },
    
    // Element için CSS seçici oluştur
    getSelector: function(el) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += `#${el.id}`;
      } else if (el.className) {
        selector += `.${el.className.split(' ').join('.')}`;
      }
      return selector;
    },
    
    // Büyük objeler (potansiyel bellek sorunları)
    findLargeObjects: function() {
      const objects = [];
      
      for (const prop in window) {
        try {
          if (typeof window[prop] === 'object' && window[prop] !== null) {
            const size = this.roughSizeOfObject(window[prop]);
            if (size > 1000000) { // 1MB'dan büyük objeler
              objects.push({
                name: prop,
                type: typeof window[prop],
                size: `${(size / 1024 / 1024).toFixed(2)} MB`
              });
            }
          }
        } catch (e) {
          // Erişim izni olmayan özellikler için geç
        }
      }
      
      console.log(`%c[Debug] Büyük Obje Taraması Tamamlandı`, this.colors.info);
      if (objects.length > 0) {
        console.warn(`%c[Uyarı] ${objects.length} büyük obje bulundu:`, this.colors.warning);
        console.table(objects);
      } else {
        console.log(`%c[İyi] Büyük objeler bulunamadı.`, this.colors.success);
      }
    },
    
    // Kabaca obje boyutunu tahmin et
    roughSizeOfObject: function(object) {
      const objectList = [];
      const stack = [object];
      let bytes = 0;
      
      while (stack.length) {
        const value = stack.pop();
        
        if (typeof value === 'boolean') {
          bytes += 4;
        } else if (typeof value === 'string') {
          bytes += value.length * 2;
        } else if (typeof value === 'number') {
          bytes += 8;
        } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
          objectList.push(value);
          
          if (value !== null) {
            for (const i in value) {
              if (Object.prototype.hasOwnProperty.call(value, i)) {
                stack.push(value[i]);
              }
            }
          }
        }
        
        // Çok büyük objeler için erken çık
        if (bytes > 100000000) { // 100MB sınırı
          return bytes;
        }
      }
      
      return bytes;
    },
    
    // Yapılan AJAX isteklerini izle
    monitorXHR: function() {
      const oldXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
          try {
            const response = JSON.parse(this.responseText);
            console.log(`%c[XHR] ${method} ${url}`, jsDebug.colors.info);
            console.log('Yanıt:', response);
          } catch (e) {
            console.log(`%c[XHR] ${method} ${url}`, jsDebug.colors.info);
            console.log('Yanıt (JSON değil):', this.responseText);
          }
        });
        
        oldXHROpen.apply(this, arguments);
      };
      
      // Fetch API'yi de izle
      const originalFetch = window.fetch;
      window.fetch = function() {
        const fetchCall = originalFetch.apply(this, arguments);
        const url = arguments[0];
        const options = arguments[1] || {};
        
        console.log(`%c[Fetch] ${options.method || 'GET'} ${url}`, jsDebug.colors.info);
        console.log('Seçenekler:', options);
        
        return fetchCall.then(response => {
          // Clone the response so we can read it and still return the original
          const clone = response.clone();
          clone.json().then(data => {
            console.log(`%c[Fetch Yanıt] ${options.method || 'GET'} ${url}`, jsDebug.colors.success);
            console.log('Veri:', data);
          }).catch(() => {
            console.log(`%c[Fetch Yanıt] ${options.method || 'GET'} ${url} (JSON değil)`, jsDebug.colors.success);
          });
          
          return response;
        });
      };
      
      console.log(`%c[Debug] XHR ve Fetch izleme aktif edildi`, this.colors.success);
    },
    
    // Sayfadaki JavaScript hatalarını göster
    checkForErrors: function() {
      if (!window.performance || !window.performance.getEntries) {
        console.warn(`%c[Debug] Performance API desteklenmiyor`, this.colors.warning);
        return;
      }
      
      const resources = window.performance.getEntries();
      const failedResources = resources.filter(r => r.entryType === 'resource' && 
        (r.name.endsWith('.js') || r.name.endsWith('.js?')) && 
        (r.transferSize === 0 || r.decodedBodySize === 0));
      
      if (failedResources.length > 0) {
        console.warn(`%c[Uyarı] ${failedResources.length} JavaScript dosyası yüklenemedi:`, this.colors.warning);
        failedResources.forEach(r => {
          console.warn(`- ${r.name}`);
        });
      } else {
        console.log(`%c[İyi] Tüm JavaScript dosyaları başarıyla yüklendi.`, this.colors.success);
      }
    },
    
    // Hepsini başlat
    init: function() {
      console.clear();
      console.log(`%c[JsDebugger v${this.version}] Başlatılıyor...`, this.colors.info);
      
      this.catchErrors();
      this.monitorXHR();
      this.checkForErrors();
      
      console.log(`%c
      ╔════════════════════════════════════════╗
      ║  JavaScript Debugger Aktif             ║
      ╠════════════════════════════════════════╣
      ║ jsDebug.watch('değişkenAdı')           ║
      ║ jsDebug.traceFunction('obje', 'fn')    ║
      ║ jsDebug.findLargeObjects()             ║
      ║ jsDebug.checkEventListeners()          ║
      ╚════════════════════════════════════════╝`, 'color: #0066ff');
      
      return this;
    }
  };
  
  // Global olarak değişkeni ata
  window.jsDebug = jsDebug;
  return jsDebug.init();
})();
