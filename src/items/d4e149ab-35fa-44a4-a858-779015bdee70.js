// Item: context-menu-css
// ID: d4e149ab-35fa-44a4-a858-779015bdee70
// Type: 23b66a83-5c61-4320-9517-5aa2abad2d1f

/* Context Menu Styles */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 180px;
  padding: 4px 0;
  z-index: 10000;
  display: none;
}

.context-menu.visible {
  display: block;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.context-menu-item:hover {
  background: #f0f0f0;
}

.context-menu-item.disabled {
  color: #999;
  cursor: default;
}

.context-menu-item.disabled:hover {
  background: transparent;
}

.context-menu-item.selected {
  font-weight: 500;
  color: #0066cc;
}

.context-menu-separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
}

.context-menu-submenu {
  position: relative;
}

.context-menu-submenu::after {
  content: '\25b6';
  font-size: 10px;
  margin-left: auto;
  color: #666;
}

.context-menu-submenu-items {
  position: absolute;
  left: 100%;
  top: 0;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 160px;
  padding: 4px 0;
  display: none;
}

.context-menu-submenu:hover .context-menu-submenu-items {
  display: block;
}

/* Flip submenu to left side when menu is near right edge */
.context-menu.submenu-left .context-menu-submenu-items {
  left: auto;
  right: 100%;
}

.context-menu.submenu-left .context-menu-submenu::after {
  content: '\25c0';
  margin-left: 0;
  margin-right: auto;
  order: -1;
}
