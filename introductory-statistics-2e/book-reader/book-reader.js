// book-reader.js - Refined Reader UI with Robust Selection-to-Input Sync & Stale Data Cleaning
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('liberosis.xyz')
  ? ''
  : 'https://liberosis-review.vqtrung357.workers.dev';

function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('liberosis_session_token');
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.currentUser = { name: 'Editor BỘT' };
    initializeReader();
    return;
  }

  fetchWithAuth(API_BASE + '/api/auth/me')
    .then(response => {
      if (!response.ok) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
      }
      return response.json();
    })
    .then(user => {
      window.currentUser = user;
      initializeReader();
    })
    .catch(err => {
      console.warn('Auth check failed:', err);
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.currentUser = { name: 'Editor BỘT' };
        initializeReader();
      }
    });
});

function initializeReader() {
  const body = document.body;
  const mainContent = document.createElement('div');
  mainContent.id = 'br-main-content';

  while (body.firstChild) {
    mainContent.appendChild(body.firstChild);
  }

  const pathParts = window.location.pathname.split('/');
  const bookId = pathParts[2] || pathParts[1] || 'book';
  const pageId = pathParts.slice(3).join('/') || pathParts.slice(2).join('/') || 'page';

  const DRAFT_KEY = `bot_draft_${bookId}_${pageId}`;
  const COMMENTS_KEY = `bot_comments_${bookId}_${pageId}`;

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function cleanBlockId(blockId) {
    if (!blockId) return '';
    return blockId.replace(/-vn$/, '');
  }

  function getBlockLocationContext(blockEl) {
    if (!blockEl) return '';
    let headingText = '';
    let curr = blockEl.previousElementSibling;
    while (curr) {
      if (/^H[1-6]$/i.test(curr.tagName)) {
        headingText = curr.textContent.trim();
        break;
      }
      if (curr.previousElementSibling) {
        curr = curr.previousElementSibling;
      } else if (curr.parentElement && curr.parentElement !== mainContent && curr.parentElement !== document.body) {
        curr = curr.parentElement.previousElementSibling;
      } else {
        break;
      }
    }

    const activeToc = document.querySelector('.br-toc-item.active');
    const tocTitle = activeToc ? activeToc.textContent.trim() : '';
    const bId = cleanBlockId(blockEl.getAttribute('id') || '');

    let parts = [];
    if (tocTitle) parts.push(tocTitle);
    if (headingText && headingText !== tocTitle) parts.push(headingText);
    if (bId) parts.push(`(${bId})`);

    return parts.join(' > ') || bId || 'Mục hiện tại';
  }

  // Create Right Panel with tabs: Inspector | Comments | Preview Báo cáo
  const rightPanel = document.createElement('div');
  rightPanel.id = 'br-right-panel';
  rightPanel.innerHTML = `
    <div id="br-panel-header">
      <div class="br-header-left">
        <button id="br-prev-btn" title="Previous">&larr;</button>
        <button id="br-next-btn" title="Next">&rarr;</button>
      </div>
      <div class="br-header-center">
        <a href="/library.html" class="br-home-link" title="Thư viện sách">📚 Library</a>
        <span class="br-divider">|</span>
        <button id="br-swap-btn">Swap to EN</button>
      </div>
      <div class="br-header-right">
        <span id="br-user-name">${window.currentUser ? window.currentUser.name : 'Editor'}</span>
        <button id="br-close-panel-btn" class="br-mobile-close-btn" title="Đóng panel">✕</button>
      </div>
    </div>
    
    <div class="br-tabs-header">
      <button id="br-tab-inspector" class="br-tab-btn">Inspector</button>
      <button id="br-tab-review" class="br-tab-btn active">Comments <span id="br-review-badge-count" class="badge-count hidden">0</span></button>
      <button id="br-tab-preview" class="br-tab-btn">📊 Xem trước Báo cáo</button>
    </div>
    
    <div id="br-tab-content-inspector" class="br-tab-pane">
      <div id="br-eng-section">
        <div class="section-title">Translation Counterpart</div>
        <div id="br-eng-content">Hover over text to see translation here.</div>
      </div>
      <div id="br-term-section">
        <div class="section-title">Glossary Definition</div>
        <div id="br-term-details">Hover over a highlighted term to see details.</div>
      </div>
    </div>
    
    <div id="br-tab-content-review" class="br-tab-pane active" style="padding: 10px; display: flex; flex-direction: column; overflow-y: auto;">
      <div id="br-review-placeholder" class="review-placeholder" style="padding: 16px 12px; text-align: center;">
        <div class="placeholder-icon" style="font-size: 1.6rem; margin-bottom: 4px;">💬</div>
        <p style="font-size: 0.82rem; color: #64748b; margin: 0; line-height: 1.4;">Bôi đen chữ hoặc nhấp chọn đoạn văn để tạo nhận xét biên tập.</p>
      </div>
      
      <div id="br-review-active" class="review-active" style="display: none;">
        <div class="br-selected-preview" style="background: #f1f5f9; padding: 8px 10px; border-radius: 6px; margin-bottom: 8px;">
          <div class="preview-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
            <h4 style="margin: 0; font-size: 0.78rem; color: #334155; font-weight: 700;">Original English</h4>
            <span class="block-id-tag" id="br-active-block-id" style="font-size: 0.7rem; background: #e2e8f0; color: #475569; padding: 1px 5px; border-radius: 4px;"></span>
          </div>
          <div id="br-active-block-text" class="block-preview-text" style="font-size: 0.8rem; color: #1e293b; font-style: normal; font-weight: 400; max-height: 60px; overflow-y: auto;"></div>
        </div>
        
        <!-- Structured Audit Form -->
        <form id="br-comment-form" class="review-form" style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 10px;">
          <div class="form-group-sm" style="margin-bottom: 6px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">📌 Đoạn cần sửa:</label>
            <textarea id="br-target-text-input" rows="1" style="width: 100%; font-size: 0.78rem; padding: 5px 7px; border-radius: 5px; border: 1px solid #cbd5e1; background: #f8fafc; font-family: inherit; box-sizing: border-box;" placeholder="Nhấp chọn hoặc bôi đen văn bản..."></textarea>
          </div>

          <div class="form-group-sm" style="margin-bottom: 6px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">🏷️ Loại lỗi:</label>
            <select id="br-error-type-select" style="width: 100%; font-size: 0.78rem; padding: 5px 7px; border-radius: 5px; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 600; font-family: inherit; box-sizing: border-box;">
              <option value="Lỗi dịch">🔵 Lỗi dịch</option>
              <option value="Lỗi nhận diện tên riêng">🟠 Lỗi nhận diện tên riêng</option>
              <option value="Lỗi định dạng">🔴 Lỗi định dạng</option>
              <option value="Lỗi thuật ngữ">🟣 Lỗi thuật ngữ</option>
              <option value="Lỗi nội dung">🟡 Lỗi nội dung / Ngữ pháp</option>
            </select>
          </div>

          <div class="form-group-sm" style="margin-bottom: 6px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">💡 Đề nghị sửa thành:</label>
            <textarea id="br-suggestion-input" rows="1" style="width: 100%; font-size: 0.78rem; padding: 5px 7px; border-radius: 5px; border: 1px solid #cbd5e1; background: #ffffff; font-family: inherit; box-sizing: border-box;" placeholder="Nhập bản dịch hoặc cách viết sửa lại..." required></textarea>
          </div>

          <div class="form-group-sm" style="margin-bottom: 8px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">📝 Lý do sửa / Cách làm đúng:</label>
            <textarea id="br-reason-input" rows="1" style="width: 100%; font-size: 0.78rem; padding: 5px 7px; border-radius: 5px; border: 1px solid #cbd5e1; background: #ffffff; font-family: inherit; box-sizing: border-box;" placeholder="Giải thích vì sao cần sửa..."></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" id="br-submit-btn" style="background: #0071e3; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.78rem; cursor: pointer; transition: background 0.2s;">
              + Thêm phản biện
            </button>
          </div>
        </form>
      </div>

      <!-- Mục Quản Lý Tất Cả Comments Đã Tạo -->
      <div class="all-comments-container" style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-weight: 700; font-size: 0.8rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            📋 PHẢN BIỆN ĐÃ TẠO
            <button id="br-clear-all-comments-btn" title="Xóa toàn bộ phản biện nháp cũ" style="background: none; border: none; font-size: 0.7rem; color: #94a3b8; text-decoration: underline; cursor: pointer; font-weight: 400;">Xóa tất cả</button>
          </span>
          
          <select id="br-comments-filter-select" style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; background: #ffffff; font-weight: 600; color: #475569;">
            <option value="all">Tất cả loại lỗi</option>
            <option value="Lỗi dịch">Lỗi dịch</option>
            <option value="Lỗi nhận diện tên riêng">Lỗi nhận diện tên riêng</option>
            <option value="Lỗi định dạng">Lỗi định dạng</option>
            <option value="Lỗi thuật ngữ">Lỗi thuật ngữ</option>
            <option value="Lỗi nội dung">Lỗi nội dung</option>
          </select>
        </div>

        <div id="br-all-comments-list" class="review-list" style="max-height: 380px; overflow-y: auto;"></div>
      </div>
    </div>

    <!-- Live Preview Tab Button Handler -->
    <div id="br-tab-content-preview" class="br-tab-pane" style="padding: 12px; text-align: center;">
      <p style="font-size: 0.85rem; color: #64748b;">Đã mở Bảng Báo Cáo Audit trong Tab mới. Nhấp nút dưới đây nếu chưa thấy tab mới:</p>
      <button id="br-open-report-newtab-btn" style="background: #1d4ed8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
        🚀 Mở Trang Báo Cáo Audit (Realtime)
      </button>
    </div>
  `;

  const tocPanel = document.createElement('div');
  tocPanel.id = 'br-toc-panel';
  tocPanel.innerHTML = `
    <div class="br-toc-header">Mục lục</div>
    <div class="br-toc-list" id="br-toc-list"></div>
  `;

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'br-toc-toggle';
  toggleBtn.className = 'br-toc-toggle-btn';
  toggleBtn.innerHTML = '☰ Mục lục';
  body.appendChild(toggleBtn);

  const backBtn = document.createElement('a');
  backBtn.id = 'br-back-to-library';
  backBtn.className = 'br-back-to-library-btn';
  backBtn.href = '/library.html';
  backBtn.title = 'Quay lại thư viện chọn sách';
  backBtn.innerHTML = '‹ Thư viện';
  body.appendChild(backBtn);

  body.appendChild(tocPanel);
  body.appendChild(mainContent);
  body.appendChild(rightPanel);

  const tocState = localStorage.getItem('br-toc-open');
  if (tocState === 'true') {
    body.classList.add('toc-open');
    toggleBtn.innerHTML = '✕ Đóng';
  } else {
    body.classList.remove('toc-open');
    toggleBtn.innerHTML = '☰ Mục lục';
  }

  toggleBtn.addEventListener('click', () => {
    const isOpen = body.classList.toggle('toc-open');
    localStorage.setItem('br-toc-open', isOpen);
    toggleBtn.innerHTML = isOpen ? '✕ Đóng' : '☰ Mục lục';
  });

  // Populate TOC synchronously from window.BOOK_PAGES
  function populateTOC() {
    const tocList = document.getElementById('br-toc-list');
    if (!tocList) return;

    let pages = window.BOOK_PAGES || [];
    if (pages.length > 0) {
      tocList.innerHTML = '';
      pages.forEach(path => {
        const item = document.createElement('a');
        item.className = 'br-toc-item';

        let cleanTitle = path.replace('.html', '').split('/').pop().replace(/-/g, ' ');
        cleanTitle = cleanTitle.replace(/^(\d+)-(\d+)-/, '$1.$2 ').replace(/^(\d+)-/, '$1. ');
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

        const currentPath = window.location.pathname;
        let cleanPage = path.replace('.html', '');
        if (currentPath.includes(cleanPage) || currentPath.endsWith(cleanPage)) {
          item.classList.add('active');
        }

        item.setAttribute('data-href', path);
        item.href = '#';
        item.textContent = cleanTitle;
        tocList.appendChild(item);
      });
    }

    if (bookId) {
      fetchWithAuth(API_BASE + `/api/book/${bookId}/toc`)
        .then(res => res.ok ? res.json() : [])
        .then(tocData => {
          if (Array.isArray(tocData) && tocData.length > 0) {
            tocList.innerHTML = '';
            tocData.forEach((itemData) => {
              const item = document.createElement('a');
              item.className = 'br-toc-item';
              let cleanPage = itemData.path.replace('.html', '');
              const currentPath = window.location.pathname;
              if (currentPath.includes(cleanPage)) {
                item.classList.add('active');
              }
              item.setAttribute('data-href', itemData.path);
              item.href = '#';
              item.textContent = itemData.title;
              tocList.appendChild(item);
            });
          }
        })
        .catch(() => {});
    }

    tocList.addEventListener('click', (e) => {
      const link = e.target.closest('.br-toc-item');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('data-href');
        navigateTo(href);
      }
    });
  }

  populateTOC();

  // Navigation Helper
  let chapterFiles = window.BOOK_PAGES || [];
  let currentIndex = -1;
  if (chapterFiles.length > 0) {
    const currentPath = window.location.pathname;
    currentIndex = chapterFiles.findIndex(page => {
      let cleanPage = page.replace('.html', '');
      return currentPath.includes(cleanPage);
    });
  }

  const prevBtn = document.getElementById('br-prev-btn');
  const nextBtn = document.getElementById('br-next-btn');
  if (currentIndex <= 0) prevBtn.disabled = true;
  if (currentIndex === -1 || currentIndex >= chapterFiles.length - 1) nextBtn.disabled = true;

  function navigateTo(url) {
    document.body.classList.add('br-fade-out');
    setTimeout(() => {
      let targetUrl = url;
      if (targetUrl.startsWith('/')) {
        targetUrl = '..' + targetUrl;
      }
      window.location.href = targetUrl;
    }, 150);
  }

  function navigateToPage(targetPage) {
    if (!targetPage) return;
    let cleanTarget = targetPage.replace(/\.html$/, '');
    const currentPath = window.location.pathname;

    if (currentPath.includes(cleanTarget)) return;

    let foundPage = (window.BOOK_PAGES || []).find(p => p.includes(cleanTarget));
    let url = foundPage || (cleanTarget + '.html');

    const targetFileName = url.split('/').pop();

    if (currentPath.includes('/chapter-') && url.includes('/')) {
      const currentChap = currentPath.split('/chapter-')[1]?.split('/')[0];
      const targetChap = url.split('chapter-')[1]?.split('/')[0];
      if (currentChap && targetChap && currentChap === targetChap) {
        url = targetFileName;
      } else {
        url = '../' + url;
      }
    }

    navigateTo(url);
  }

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) navigateTo(chapterFiles[currentIndex - 1]);
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex > -1 && currentIndex < chapterFiles.length - 1) navigateTo(chapterFiles[currentIndex + 1]);
  });

  // Form persistence handlers
  const targetInput = document.getElementById('br-target-text-input');
  const errorTypeSelect = document.getElementById('br-error-type-select');
  const suggestionInput = document.getElementById('br-suggestion-input');
  const reasonInput = document.getElementById('br-reason-input');

  function saveFormDraft() {
    const draft = {
      targetText: targetInput ? targetInput.value : '',
      errorType: errorTypeSelect ? errorTypeSelect.value : 'Lỗi dịch',
      suggestedText: suggestionInput ? suggestionInput.value : '',
      reason: reasonInput ? reasonInput.value : ''
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function restoreFormDraft() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (targetInput && draft.targetText) targetInput.value = draft.targetText;
        if (errorTypeSelect && draft.errorType) errorTypeSelect.value = draft.errorType;
        if (suggestionInput && draft.suggestedText) suggestionInput.value = draft.suggestedText;
        if (reasonInput && draft.reason) reasonInput.value = draft.reason;
      }
    } catch (e) {}
  }

  [targetInput, errorTypeSelect, suggestionInput, reasonInput].forEach(input => {
    if (input) {
      input.addEventListener('input', saveFormDraft);
      input.addEventListener('change', saveFormDraft);
    }
  });

  restoreFormDraft();

  // Get local chapter-wide comments
  const currentChapterId = (pageId.includes('/') ? pageId.split('/')[0] : pageId).toLowerCase();

  function getLocalChapterComments() {
    const allComments = [];
    const prefix = `bot_comments_${bookId}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const pagePath = key.substring(prefix.length).toLowerCase();
        const pageChapter = pagePath.includes('/') ? pagePath.split('/')[0] : pagePath;

        if (pageChapter === currentChapterId || pagePath.startsWith(currentChapterId + '/') || pagePath.startsWith(currentChapterId)) {
          try {
            const list = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(list)) {
              list.forEach(c => {
                c._pageKey = key;
                allComments.push(c);
              });
            }
          } catch (e) {}
        }
      }
    }

    const map = new Map();
    allComments.forEach(c => map.set(c.id, c));
    return Array.from(map.values())
      .filter(c => {
        const text = (c.targetText || c.selectedText || c.text || '').trim();
        return text !== 'thích' && text !== 'nice' && text !== 'great' && text !== 'test';
      })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }

  function getLocalComments() {
    return getLocalChapterComments();
  }

  function saveLocalComments(comments) {
    try {
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }

  // Clear all comments button handler
  const clearAllBtn = document.getElementById('br-clear-all-comments-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Bạn có muốn xóa toàn bộ phản biện đã tạo trong chương này không?')) {
        cachedPageComments = [];
        const prefix = `bot_comments_${bookId}_`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const pagePath = key.substring(prefix.length).toLowerCase();
            const pageChapter = pagePath.includes('/') ? pagePath.split('/')[0] : pagePath;
            if (pageChapter === currentChapterId || pagePath.startsWith(currentChapterId)) {
              localStorage.removeItem(key);
            }
          }
        }
        window.dispatchEvent(new Event('storage'));
        renderCommentsList();
        updateHeaderBadge();
        mainContent.querySelectorAll('mark.br-text-highlight').forEach(mark => {
          const parent = mark.parentNode;
          if (parent) {
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
          }
        });
      }
    });
  }

  // Glossary
  let glossaryData = [];
  fetch('../glossary.csv')
    .then(r => r.ok ? r.text() : '')
    .then(csv => {
      if (!csv) return;
      const lines = csv.split('\n').filter(l => l.trim() !== '');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim());
      glossaryData = lines.slice(1).map(l => {
        const vals = l.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => obj[h] = vals[i] || '');
        return obj;
      });
    })
    .catch(() => {});

  const termElements = mainContent.querySelectorAll('[data-type="term"]');
  termElements.forEach(el => el.classList.add('br-highlight-term'));

  let isEnMode = false;
  const swapBtn = document.getElementById('br-swap-btn');
  const engContentPanel = document.getElementById('br-eng-content');
  const termDetailsContainer = document.getElementById('br-term-details');

  swapBtn.addEventListener('click', () => {
    isEnMode = !isEnMode;
    if (isEnMode) {
      document.body.classList.add('lang-swap');
      swapBtn.textContent = 'Swap to VN';
    } else {
      document.body.classList.remove('lang-swap');
      swapBtn.textContent = 'Swap to EN';
    }
    engContentPanel.innerHTML = 'Hover over text to see translation counterpart.';
    termDetailsContainer.innerHTML = 'Hover over a term to see glossary details.';
  });

  // Tab switching logic (Inspector | Comments | Preview Báo cáo)
  const tabInspector = document.getElementById('br-tab-inspector');
  const tabReview = document.getElementById('br-tab-review');
  const tabPreview = document.getElementById('br-tab-preview');

  const paneInspector = document.getElementById('br-tab-content-inspector');
  const paneReview = document.getElementById('br-tab-content-review');
  const panePreview = document.getElementById('br-tab-content-preview');

  function openReportNewTab() {
    const pathParts = pageId.split('/');
    const chapterId = pathParts[0] || 'chapter-1';
    window.open(`/audit-report.html?bookId=${bookId}&chapterId=${encodeURIComponent(chapterId)}&pageId=${encodeURIComponent(pageId)}`, '_blank');
  }

  function switchTab(tabId) {
    [tabInspector, tabReview, tabPreview].forEach(t => t.classList.remove('active'));
    [paneInspector, paneReview, panePreview].forEach(p => p.classList.remove('active'));

    if (tabId === 'inspector') {
      tabInspector.classList.add('active');
      paneInspector.classList.add('active');
    } else if (tabId === 'review') {
      tabReview.classList.add('active');
      paneReview.classList.add('active');
    } else if (tabId === 'preview') {
      tabPreview.classList.add('active');
      panePreview.classList.add('active');
      openReportNewTab();
    }
  }

  tabInspector.addEventListener('click', () => switchTab('inspector'));
  tabReview.addEventListener('click', () => switchTab('review'));
  tabPreview.addEventListener('click', () => switchTab('preview'));

  const openReportBtn = document.getElementById('br-open-report-newtab-btn');
  if (openReportBtn) {
    openReportBtn.addEventListener('click', openReportNewTab);
  }

  // Highlight Text Selection on Page persistent yellow highlight
  function applyYellowHighlightToSelection(commentId) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;

    try {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();
      if (!selectedText) return null;

      const mark = document.createElement('mark');
      mark.className = 'br-text-highlight';
      if (commentId) mark.setAttribute('data-comment-id', commentId);

      const textSpan = document.createElement('span');
      textSpan.textContent = selectedText;
      mark.appendChild(textSpan);

      const removeBtn = document.createElement('span');
      removeBtn.className = 'br-mark-remove-btn';
      removeBtn.title = 'Hủy bôi vàng & phản biện';
      removeBtn.textContent = '✕';
      mark.appendChild(removeBtn);

      range.deleteContents();
      range.insertNode(mark);
      return mark;
    } catch (e) {
      console.warn('Selection surround failed:', e);
      return null;
    }
  }

  // Universal Bulletproof Highlight Engine
  function applyHighlightsForComments(comments) {
    if (!Array.isArray(comments)) return;

    const currentClean = window.location.pathname.split('/').pop().replace(/\.html$/, '');

    comments.forEach(c => {
      // Only highlight marks on DOM if comment belongs to the current page
      if (c.pageId) {
        const cClean = c.pageId.split('/').pop().replace(/\.html$/, '');
        if (cClean !== currentClean) return;
      }

      const textToFind = (c.targetText || c.selectedText || c.text || '').trim();
      if (!textToFind || textToFind.length < 2 || textToFind === 'thích' || textToFind === 'nice' || textToFind === 'great') return;

      if (mainContent.querySelector(`mark[data-comment-id="${c.id}"]`)) return;

      let targetEl = null;
      if (c.blockId) {
        targetEl = document.getElementById(`${c.blockId}-vn`) || document.getElementById(c.blockId);
      }

      if (!targetEl) {
        const allBlocks = mainContent.querySelectorAll('.vn.visible, p, h1, h2, h3, h4, li');
        for (const el of allBlocks) {
          if (el.textContent.includes(textToFind)) {
            targetEl = el;
            break;
          }
        }
      }

      if (targetEl) {
        const html = targetEl.innerHTML;
        if (html.includes(textToFind) && !html.includes(`data-comment-id="${c.id}"`)) {
          const safeText = escapeRegex(textToFind);
          const replaced = html.replace(
            new RegExp(safeText),
            `<mark class="br-text-highlight" data-comment-id="${c.id}">${escapeHtml(textToFind)}<span class="br-mark-remove-btn" title="Hủy bôi vàng & phản biện">✕</span></mark>`
          );
          targetEl.innerHTML = replaced;
        }
      }
    });
  }

  // Active block selection & Selection Sync
  let activeBlockId = null;
  let activeLocationContext = '';
  let activeSelectedBlockEl = null;

  function selectBlock(blockEl) {
    const previouslySelected = mainContent.querySelectorAll('.br-block-selected');
    previouslySelected.forEach(el => el.classList.remove('br-block-selected'));

    blockEl.classList.add('br-block-selected');
    activeSelectedBlockEl = blockEl;

    const rawBlockId = blockEl.getAttribute('id');
    activeBlockId = cleanBlockId(rawBlockId);
    activeLocationContext = getBlockLocationContext(blockEl);

    let englishText = '';
    let vnText = blockEl.textContent.trim();

    if (blockEl.classList.contains('vn')) {
      const engId = rawBlockId.replace(/-vn$/, '');
      const engEl = document.getElementById(engId);
      if (engEl) englishText = engEl.textContent.trim();
    } else {
      englishText = blockEl.textContent.trim();
    }

    switchTab('review');
    
    document.getElementById('br-review-placeholder').style.display = 'none';
    document.getElementById('br-review-active').style.display = 'block';
    document.getElementById('br-active-block-id').textContent = activeLocationContext || activeBlockId;
    document.getElementById('br-active-block-text').textContent = englishText || 'English original counterpart not found.';

    // Sync selected text to targetInput strictly
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';

    if (targetInput) {
      if (selectedText.length >= 2) {
        targetInput.value = selectedText;
      } else {
        targetInput.value = vnText.substring(0, 200);
      }
      saveFormDraft();
    }
  }

  mainContent.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.br-mark-remove-btn');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const mark = removeBtn.closest('mark.br-text-highlight');
      if (mark) {
        const commentId = mark.getAttribute('data-comment-id');
        if (commentId) {
          cachedPageComments = cachedPageComments.filter(c => c.id !== commentId);
          saveLocalComments(cachedPageComments);
          renderCommentsList();
          updateHeaderBadge();
          fetchWithAuth(API_BASE + `/api/comments/${commentId}`, { method: 'DELETE' }).catch(() => {});
        }
        const parent = mark.parentNode;
        if (parent) {
          while (mark.firstChild) {
            if (mark.firstChild !== removeBtn) {
              parent.insertBefore(mark.firstChild, mark);
            } else {
              mark.removeChild(removeBtn);
            }
          }
          parent.removeChild(mark);
        }
      }
      return;
    }

    const blockEl = e.target.closest('.vn.visible, .eng.hidden');
    if (blockEl) {
      selectBlock(blockEl);
    }
  });

  // Floating selection comment button
  const floatingCommentBtn = document.createElement('button');
  floatingCommentBtn.id = 'br-floating-add-comment-btn';
  floatingCommentBtn.className = 'br-floating-comment-btn';
  floatingCommentBtn.innerHTML = '💬 + Thêm phản biện';
  floatingCommentBtn.style.display = 'none';
  document.body.appendChild(floatingCommentBtn);

  let currentSelectedText = '';
  let selectedParentBlock = null;

  function updateFloatingButtonPosition() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      floatingCommentBtn.style.display = 'none';
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      floatingCommentBtn.style.display = 'none';
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const parentBlock = (container.nodeType === 1 ? container : container.parentElement).closest('.vn.visible, .eng.hidden');

    if (!parentBlock || !mainContent.contains(parentBlock)) {
      floatingCommentBtn.style.display = 'none';
      return;
    }

    currentSelectedText = text;
    selectedParentBlock = parentBlock;

    const rect = range.getBoundingClientRect();
    floatingCommentBtn.style.position = 'fixed';
    floatingCommentBtn.style.left = `${Math.max(10, rect.left + rect.width / 2 - 65)}px`;
    floatingCommentBtn.style.top = `${Math.max(10, rect.top - 42)}px`;
    floatingCommentBtn.style.display = 'flex';
  }

  mainContent.addEventListener('mouseup', () => {
    setTimeout(updateFloatingButtonPosition, 10);
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      floatingCommentBtn.style.display = 'none';
    }
  });

  floatingCommentBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedParentBlock || !currentSelectedText) return;

    selectBlock(selectedParentBlock);
    applyYellowHighlightToSelection();

    if (targetInput) targetInput.value = currentSelectedText;
    if (suggestionInput) suggestionInput.focus();
    saveFormDraft();

    floatingCommentBtn.style.display = 'none';
  });

  let currentFilter = 'all';
  const commentsFilterSelect = document.getElementById('br-comments-filter-select');
  if (commentsFilterSelect) {
    commentsFilterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      renderCommentsList();
    });
  }

  let cachedPageComments = [];

  // Render Comments as Single-Line Row Items (Target ➔ Suggestion)
  function renderCommentsList() {
    const container = document.getElementById('br-all-comments-list');
    const badge = document.getElementById('br-review-badge-count');

    if (!container) return;
    container.innerHTML = '';

    const filtered = currentFilter === 'all' 
      ? cachedPageComments 
      : cachedPageComments.filter(c => (c.errorType || 'Lỗi dịch') === currentFilter);

    if (badge) {
      if (cachedPageComments.length > 0) {
        badge.textContent = cachedPageComments.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 0.78rem;">${cachedPageComments.length === 0 ? 'Chưa có phản biện nào.' : 'Không có phản biện thuộc nhóm này.'}</div>`;
      return;
    }

    filtered.forEach(c => {
      const item = document.createElement('div');
      item.className = 'br-comment-single-row';
      item.setAttribute('data-block-id', c.blockId);
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.15s, border-color 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.02);';

      let targetSnippet = (c.targetText || c.selectedText || '').trim();
      let suggestSnippet = (c.suggestedText || '').trim();

      let displayText = '';
      if (targetSnippet && suggestSnippet) {
        displayText = `${targetSnippet} ➔ ${suggestSnippet}`;
      } else if (targetSnippet) {
        displayText = targetSnippet;
      } else if (suggestSnippet) {
        displayText = suggestSnippet;
      } else {
        displayText = c.reason || c.text || (c.blockId ? `Mục ${c.blockId}` : 'Khối phản biện');
      }

      let secBadgeHtml = '';
      if (c.pageId) {
        const pageName = c.pageId.split('/').pop().replace(/\.html$/, '');
        const secMatch = pageName.match(/^(\d+\.\d+|\d+-\d+)/);
        if (secMatch) {
          const secTag = secMatch[1].replace('-', '.');
          secBadgeHtml = `<span style="font-size: 0.68rem; background: #e0f2fe; color: #0369a1; padding: 1px 4px; border-radius: 3px; font-weight: 700; flex-shrink: 0;">[${secTag}]</span>`;
        }
      }

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; min-width: 0;">
          <span style="font-size: 0.7rem; color: #0284c7; flex-shrink: 0;">📍</span>
          ${secBadgeHtml}
          <span style="font-size: 0.78rem; color: #1e293b; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayText)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 6px;">
          <span style="font-size: 0.68rem; color: #94a3b8;">${new Date(c.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          <button class="br-delete-single-comment-btn" data-comment-id="${c.id}" title="Xóa phản biện này" style="background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; padding: 1px 4px; border-radius: 3px;">✕</button>
        </div>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#f8fafc';
        item.style.borderColor = '#0071e3';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = '#ffffff';
        item.style.borderColor = '#e2e8f0';
      });

      // 4-Step Navigation Algorithm when row is clicked
      item.addEventListener('click', (e) => {
        if (e.target.closest('.br-delete-single-comment-btn')) return;

        if (c.pageId) {
          const targetClean = c.pageId.split('/').pop().replace(/\.html$/, '');
          const currentClean = window.location.pathname.split('/').pop().replace(/\.html$/, '');
          if (targetClean !== currentClean) {
            navigateToPage(c.pageId);
            return;
          }
        }

        let targetEl = null;

        if (c.id) {
          targetEl = mainContent.querySelector(`mark[data-comment-id="${c.id}"]`);
        }

        if (!targetEl && targetSnippet) {
          const marks = mainContent.querySelectorAll('mark.br-text-highlight');
          for (const m of marks) {
            if (m.textContent.includes(targetSnippet)) {
              targetEl = m;
              break;
            }
          }
        }

        const bId = c.blockId;
        if (!targetEl && bId) {
          targetEl = document.getElementById(`${bId}-vn`) || document.getElementById(bId);
        }

        if (!targetEl && targetSnippet) {
          const allEls = mainContent.querySelectorAll('.vn.visible, p, h1, h2, h3, h4, li');
          for (const el of allEls) {
            if (el.textContent.includes(targetSnippet)) {
              targetEl = el;
              break;
            }
          }
        }

        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.style.transition = 'outline 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease';
          targetEl.style.outline = '3px solid #f59e0b';
          targetEl.style.backgroundColor = '#fef3c7';
          targetEl.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.4)';
          setTimeout(() => {
            targetEl.style.outline = '';
            targetEl.style.backgroundColor = '';
            targetEl.style.boxShadow = '';
          }, 2800);
        }
      });

      container.appendChild(item);
    });

    // Delete Event Handlers
    container.querySelectorAll('.br-delete-single-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const commentId = btn.getAttribute('data-comment-id');
        if (confirm('Bạn có chắc chắn muốn xóa phản biện này?')) {
          const targetComment = cachedPageComments.find(c => c.id === commentId);
          if (targetComment && targetComment._pageKey) {
            try {
              let pageComments = JSON.parse(localStorage.getItem(targetComment._pageKey)) || [];
              pageComments = pageComments.filter(c => c.id !== commentId);
              localStorage.setItem(targetComment._pageKey, JSON.stringify(pageComments));
            } catch(e) {}
          } else {
            saveLocalComments(cachedPageComments.filter(c => c.id !== commentId));
          }

          cachedPageComments = cachedPageComments.filter(c => c.id !== commentId);
          renderCommentsList();

          const mark = document.querySelector(`mark[data-comment-id="${commentId}"]`);
          if (mark) {
            const parent = mark.parentNode;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
          }

          fetchWithAuth(API_BASE + `/api/comments/${commentId}`, { method: 'DELETE' }).catch(() => {});
        }
      });
    });
  }

  function updateHeaderBadge() {
    const badge = document.getElementById('br-review-badge-count');
    if (badge) {
      if (cachedPageComments.length > 0) {
        badge.textContent = cachedPageComments.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function loadAllPageComments() {
    const localComments = getLocalChapterComments();
    cachedPageComments = localComments;
    renderCommentsList();
    applyHighlightsForComments(cachedPageComments);

    fetchWithAuth(API_BASE + `/api/comments/all?bookId=${bookId}&pageId=${pageId}`)
      .then(res => res.json())
      .then(serverComments => {
        if (Array.isArray(serverComments)) {
          const map = new Map();
          localComments.forEach(c => map.set(c.id, c));
          serverComments.forEach(c => {
            const existing = map.get(c.id);
            if (existing) {
              map.set(c.id, { ...c, ...existing });
            } else {
              map.set(c.id, c);
            }
          });
          cachedPageComments = Array.from(map.values()).filter(c => {
            const text = (c.targetText || c.selectedText || c.text || '').trim();
            return text !== 'thích' && text !== 'nice' && text !== 'great' && text !== 'test';
          }).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

          renderCommentsList();
          applyHighlightsForComments(cachedPageComments);
        }
      })
      .catch(err => {
        console.warn('Offline or server unreachable, using local session comments:', err);
      });
  }

  // Handle Comment Submission
  const commentForm = document.getElementById('br-comment-form');

  if (commentForm) {
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetTextVal = targetInput ? targetInput.value.trim() : '';
      const errorTypeVal = errorTypeSelect ? errorTypeSelect.value : 'Lỗi dịch';
      const suggestedTextVal = suggestionInput ? suggestionInput.value.trim() : '';
      const reasonVal = reasonInput ? reasonInput.value.trim() : '';

      if (!suggestedTextVal) {
        alert('Vui lòng nhập Đề nghị sửa thành!');
        return;
      }

      const bId = activeBlockId || 'general';
      const locCtx = activeLocationContext || (activeSelectedBlockEl ? getBlockLocationContext(activeSelectedBlockEl) : bId);

      const newComment = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        bookId,
        pageId,
        blockId: bId,
        locationContext: locCtx,
        name: window.currentUser ? window.currentUser.name : 'Editor BỘT',
        author: 'editor1',
        timestamp: new Date().toISOString(),
        errorType: errorTypeVal,
        targetText: targetTextVal,
        suggestedText: suggestedTextVal,
        reason: reasonVal,
        text: reasonVal || suggestedTextVal
      };

      cachedPageComments.unshift(newComment);
      saveLocalComments(cachedPageComments);
      renderCommentsList();

      if (targetTextVal) {
        applyHighlightsForComments([newComment]);
      }

      if (suggestionInput) suggestionInput.value = '';
      if (reasonInput) reasonInput.value = '';
      if (targetInput) targetInput.value = '';
      activeBlockId = null;
      activeLocationContext = '';
      activeSelectedBlockEl = null;
      localStorage.removeItem(DRAFT_KEY);

      fetchWithAuth(API_BASE + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComment)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.comment) {
            const idx = cachedPageComments.findIndex(c => c.id === newComment.id || c.id === data.comment.id);
            if (idx !== -1) {
              cachedPageComments[idx] = { ...cachedPageComments[idx], ...data.comment };
              saveLocalComments(cachedPageComments);
            }
          }
        })
        .catch(err => console.warn('Server sync pending, comment saved locally:', err));
    });
  }

  const closePanelBtn = document.getElementById('br-close-panel-btn');
  if (closePanelBtn) {
    closePanelBtn.addEventListener('click', () => {
      document.body.classList.remove('panel-open');
      const previouslySelected = mainContent.querySelectorAll('.br-block-selected');
      previouslySelected.forEach(el => el.classList.remove('br-block-selected'));
    });
  }

  loadAllPageComments();
}
