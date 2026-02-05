// kernel-safe-mode module
// See [Architecture Overview - Safe Mode](item://a0a0a0a0-d0c0-4000-8000-000000000003#Safe-Mode)

// [BEGIN:SafeMode]
export class SafeMode {
  constructor(kernel) {
    this.kernel = kernel;
  }
  
  // [BEGIN:render]
  render(rootElement) {
    rootElement.innerHTML = `
      <div id="safe-mode">
        <h1>⚠️ Safe Mode</h1>
        <p>Booted with minimal kernel only. No user code items loaded.</p>
        <p>Use this mode to fix broken code items.</p>
        <p style="color: #666; font-size: 12px;">Access safe mode anytime by adding <code>?safe=1</code> to the URL.</p>
        
        <div class="actions">
          <button onclick="kernel.safeMode.listAllItems()">View All Items</button>
          <button onclick="kernel.safeMode.listCodeItems()">View Code Items Only</button>
          <button onclick="kernel.safeMode.exportData(false)">Export All Data</button>
          <button onclick="kernel.safeMode.importData()">Import Data</button>
          <button onclick="kernel.safeMode.resetSystem()">Reset System (Dangerous!)</button>
          <button onclick="window.location.href = window.location.pathname">Exit Safe Mode</button>
        </div>
        
        <div id="item-list" class="item-list"></div>
      </div>
    `;
  }
  
  async listAllItems() {
    const items = await this.kernel.storage.getAll();
    this._renderItemList(items, "All Items");
  }
  
  async listCodeItems() {
    const items = await this.kernel.storage.getAll();
    const codeItems = [];
    
    for (const item of items) {
      if (await this.kernel.isCodeItem(item)) {
        codeItems.push(item);
      }
    }
    
    this._renderItemList(codeItems, "Code Items");
  }
  // [END:render]
  
  _renderItemList(items, title) {
    const listEl = document.getElementById("item-list");
    if (!listEl) return;
    
    listEl.innerHTML = `<h2>${title} (${items.length})</h2>`;
    
    items.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    for (const item of items) {
      const preview = document.createElement("div");
      preview.className = "item-preview";
      preview.innerHTML = `
        <div class="item-info">
          <div class="item-name">${this._escapeHtml(item.name || item.id)}</div>
          <div class="item-type">Type: ${this._escapeHtml(item.type)}</div>
        </div>
        <div>
          <button onclick="kernel.safeMode.editItem('${item.id}')">Edit as JSON</button>
          <button onclick="kernel.safeMode.deleteItem('${item.id}')" style="color: red;">Delete</button>
        </div>
      `;
      listEl.appendChild(preview);
    }
  }
  
  // [BEGIN:editItem]
  async editItem(itemId) {
    const item = await this.kernel.storage.get(itemId);
    const json = JSON.stringify(item, null, 2);
    
    const rootElement = this.kernel.rootElement;
    rootElement.innerHTML = `
      <div class="raw-editor">
        <h2>Editing: ${this._escapeHtml(item.name || item.id)}</h2>
        <textarea id="raw-json" rows="30">${this._escapeHtml(json)}</textarea>
        <div class="actions">
          <button onclick="kernel.safeMode.saveItem('${itemId}')">Save</button>
          <button onclick="kernel.safeMode.render(kernel.rootElement)">Cancel</button>
        </div>
      </div>
    `;
  }
  
  async saveItem(itemId) {
    const textarea = document.getElementById("raw-json");
    if (!textarea) return;
    
    try {
      const updated = JSON.parse(textarea.value);
      await this.kernel.saveItem(updated);
      this.kernel.moduleSystem.clearCache();
      alert("Saved successfully");
      this.render(this.kernel.rootElement);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }
  // [END:editItem]
  
  async deleteItem(itemId) {
    if (!confirm(`Delete item ${itemId}? This cannot be undone.`)) {
      return;
    }
    
    await this.kernel.storage.delete(itemId);
    await this.listAllItems();
  }
  
  async exportData(singleFile = true) {
    const count = await this.kernel.export(singleFile);
    alert(`Exported ${count} items`);
  }
  
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.setAttribute('multiple', '');

    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      try {
        let items = [];
        for (const file of files) {
          const text = await file.text();
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            items = items.concat(data);
          } else {
            items.push(data);
          }
        }

        let created = 0, updated = 0;

        for (const item of items) {
          const exists = await this.kernel.storage.exists(item.id);
          await this.kernel.saveItem(item);
          if (exists) {
            updated++;
          } else {
            created++;
          }
        }

        // Clear module cache
        this.kernel.moduleSystem.clearCache();

        alert(`Import complete!\nCreated: ${created}\nUpdated: ${updated}`);
        this.render(this.kernel.rootElement);

      } catch (error) {
        alert(`Import failed: ${error.message}`);
      }
    };

    input.click();
  }

  // [BEGIN:resetSystem]
  async resetSystem() {
    if (!confirm("WARNING: This will delete ALL your data!\n\nOnly the seed items will remain.\n\nHave you exported your data? This cannot be undone!")) {
      return;
    }
    
    const items = await this.kernel.storage.getAll();
    for (const item of items) {
      await this.kernel.storage.delete(item.id);
    }
    
    await this.kernel.ensureSeedItems();
    this.render(this.kernel.rootElement);
    alert("System reset complete");
  }
  // [END:resetSystem]
  
  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
// [END:SafeMode]
