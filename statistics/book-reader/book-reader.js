document.addEventListener('DOMContentLoaded', () => {
  // 1. Restructure DOM
  const body = document.body;
  const mainContent = document.createElement('div');
  mainContent.id = 'br-main-content';

  // Move all existing children of body into mainContent
  while (body.firstChild) {
    mainContent.appendChild(body.firstChild);
  }

  // Create Right Panel
  const rightPanel = document.createElement('div');
  rightPanel.id = 'br-right-panel';
  rightPanel.innerHTML = `
    <div id="br-panel-header" style="padding: 15px 20px; border-bottom: 1px solid #e1e4e8; background: #fff; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
      <div style="display: flex; gap: 5px; align-items: center;">
        <a id="br-home-btn" href="../../index.html" title="Trang chủ" style="background: #e1e4e8; color: #333; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; font-size: 1.1rem; line-height: 1;">&#8962;</a>
        <button id="br-toc-toggle-btn" title="Mục lục" style="background: #e1e4e8; color: #333; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; font-size: 1.1rem; line-height: 1;">▤</button>
        <button id="br-prev-btn" title="Previous" style="background: #e1e4e8; color: #333; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">&larr;</button>
        <button id="br-next-btn" title="Next" style="background: #e1e4e8; color: #333; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">&rarr;</button>
      </div>
      <h3 style="margin: 0; font-size: 1.1rem; color: #333; flex-grow: 1; text-align: center;">Book Reader</h3>
      <button id="br-swap-btn" style="background: #0366d6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Swap to EN</button>
    </div>
    <div id="br-eng-section">
      <div id="br-eng-content">Hover over the text to see the translation here.</div>
    </div>
    <div id="br-comments-section">
      <div class="br-comments-header">
        <span id="br-active-tag-label">Chọn đoạn văn để bình luận</span>
        <button id="br-pin-indicator" title="Đang ghim đoạn này. Nhấp lại vào đoạn văn để bỏ ghim." style="display: none; border: none; background: none; cursor: pointer; font-size: 1.1rem; padding: 0;">📌</button>
      </div>
      <div id="br-comments-list-wrapper">
        <div id="br-comments-list">
          <div class="br-comments-placeholder">Rê chuột hoặc nhấp vào bất kỳ đoạn văn nào để xem hoặc viết bình luận.</div>
        </div>
      </div>
      <div id="br-comments-input-area" style="display: none;">
        <input type="text" id="br-comment-username" placeholder="Tên..." />
        <input type="text" id="br-comment-text" placeholder="Viết bình luận..." />
        <button id="br-comment-submit-btn">Gửi</button>
      </div>
    </div>
  `;

  // Create floating tooltip for glossary terms
  const tooltip = document.createElement('div');
  tooltip.id = 'br-term-tooltip';
  tooltip.style.position = 'absolute';
  tooltip.style.display = 'none';
  body.appendChild(tooltip);

  // Create Mega Menu Table of Contents Modal
  const tocModal = document.createElement('div');
  tocModal.id = 'br-toc-modal';
  body.appendChild(tocModal);
  tocModal.innerHTML = `
    <div class="br-toc-modal-backdrop"></div>
    <div class="br-toc-modal-container">
      <div class="br-toc-modal-header">
        <h2>Mục lục sách</h2>
        <button class="br-toc-modal-close" title="Đóng">&times;</button>
      </div>
      <div class="br-toc-modal-body">
        <div id="br-mega-toc-grid" class="br-mega-toc-grid"></div>
      </div>
    </div>
  `;

  // Append back to body
  body.appendChild(mainContent);
  body.appendChild(rightPanel);

  // Setup TOC Modal Toggle
  const tocToggleBtn = document.getElementById('br-toc-toggle-btn');
  const closeBtn = tocModal.querySelector('.br-toc-modal-close');
  const backdrop = tocModal.querySelector('.br-toc-modal-backdrop');

  function closeTocModal() {
    tocModal.classList.remove('br-modal-show');
  }

  if (tocToggleBtn) {
    tocToggleBtn.addEventListener('click', () => {
      tocModal.classList.add('br-modal-show');
      setTimeout(() => {
        const activeItem = tocModal.querySelector('.br-mega-toc-active');
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 50);
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeTocModal);
  if (backdrop) backdrop.addEventListener('click', closeTocModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tocModal.classList.contains('br-modal-show')) {
      closeTocModal();
    }
  });

  // 2. Fetch and parse Glossary
  let glossaryData = [];
  const glossaryPath = '../glossary.csv';

  function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = [];
      let inQuotes = false;
      let currentValue = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i+1] === '"') {
          currentValue += '"';
          i++; 
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  }

  fetch(glossaryPath)
    .then(response => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.text();
    })
    .then(csvText => {
      glossaryData = parseCSV(csvText);
    })
    .catch(err => console.error('Error fetching glossary:', err));

  // 3. Highlight Terms by default
  const termElements = mainContent.querySelectorAll('[data-type="term"]');
  termElements.forEach(el => {
    el.classList.add('br-highlight-term');
  });

  // 4. State for EN/VN mode
  let isEnMode = false;
  const swapBtn = document.getElementById('br-swap-btn');
  const readingTitle = document.getElementById('br-reading-title');
  const engContentPanel = document.getElementById('br-eng-content');

  swapBtn.addEventListener('click', () => {
    isEnMode = !isEnMode;
    if (isEnMode) {
      document.body.classList.add('lang-swap');
      swapBtn.textContent = 'Swap to VN';
      if (readingTitle) readingTitle.textContent = 'Vietnamese Translation';
    } else {
      document.body.classList.remove('lang-swap');
      swapBtn.textContent = 'Swap to EN';
      if (readingTitle) readingTitle.textContent = 'Original English';
    }
    // Clear panels on swap
    engContentPanel.innerHTML = 'Hover over the text to see the translation here.';
  });

  // 4.5 Navigation Logic
  let chapterFiles = [];
  let currentIndex = -1;
  
  if (window.BOOK_PAGES && window.BOOK_PAGES.length > 0) {
    chapterFiles = window.BOOK_PAGES;
    const currentPath = window.location.pathname;
    currentIndex = chapterFiles.findIndex(page => {
        let cleanPage = page.replace('.html', '');
        // For Cloudflare index files, /index is stripped from the URL
        if (cleanPage.endsWith('/index')) {
            cleanPage = cleanPage.substring(0, cleanPage.length - 6);
        }
        let currentPathWithoutHtml = currentPath.replace('.html', '').replace(/\/$/, "");
        if (currentPathWithoutHtml.endsWith('/index')) {
            currentPathWithoutHtml = currentPathWithoutHtml.substring(0, currentPathWithoutHtml.length - 6);
        }
        return currentPathWithoutHtml === cleanPage || currentPathWithoutHtml.endsWith(cleanPage);
    });
  } else {
    // Fallback if BOOK_PAGES is somehow missing
    chapterFiles = [];
    currentIndex = -1;
  }
  
  const prevBtn = document.getElementById('br-prev-btn');
  const nextBtn = document.getElementById('br-next-btn');
  
  if (currentIndex <= 0) prevBtn.disabled = true;
  if (currentIndex === -1 || currentIndex >= chapterFiles.length - 1) nextBtn.disabled = true;
  if (prevBtn.disabled) prevBtn.style.opacity = '0.5';
  if (nextBtn.disabled) nextBtn.style.opacity = '0.5';

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

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) navigateTo(chapterFiles[currentIndex - 1]);
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex > -1 && currentIndex < chapterFiles.length - 1) navigateTo(chapterFiles[currentIndex + 1]);
  });

  // Keyboard Navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') {
      if (currentIndex > 0) navigateTo(chapterFiles[currentIndex - 1]);
    } else if (e.key === 'ArrowRight') {
      if (currentIndex > -1 && currentIndex < chapterFiles.length - 1) navigateTo(chapterFiles[currentIndex + 1]);
    }
  });

  // TOC Helpers & Rendering
  function formatPageTitle(pagePath, isChild = false) {
    const parts = pagePath.split('/');
    let filename = parts[parts.length - 1].replace('.html', '');
    
    if (filename === 'preface') return 'Lời mở đầu (Preface)';
    if (filename === 'index') return isChild ? 'Bìa sách / Giới thiệu' : 'Giới thiệu chung';
    
    // Check if it ends with "introduction"
    if (filename.endsWith('-introduction') || filename === 'introduction') {
      return 'Giới thiệu chương (Introduction)';
    }

    // Replace hyphens with spaces
    let title = filename.replace(/-/g, ' ');
    
    // Title capitalization
    title = title.split(' ').map(word => {
      if (!word) return '';
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
    
    // Clean up formats
    title = title.replace(/^(\d+)\s+(\d+)\s+/, '$1.$2 ');
    title = title.replace(/^(\d+)\s+(\d+)\s+(\d+)\s+/, '$1.$2.$3 ');
    
    // If it is like "1 Summary" -> clean and simple translation
    if (/^\d+\s+[a-zA-Z]/.test(title)) {
      const match = title.match(/^(\d+)\s+(.*)$/);
      if (match) {
        const num = match[1];
        const rest = match[2];
        const translationMap = {
          'Introduction': 'Giới thiệu',
          'Summary': 'Tóm tắt',
          'Key Terms': 'Thuật ngữ chính',
          'Review Questions': 'Câu hỏi ôn tập',
          'Discussion Questions': 'Câu hỏi thảo luận',
          'Case Questions': 'Câu hỏi tình huống',
          'Suggested Resources': 'Tài liệu tham khảo',
          'Suggested-resources': 'Tài liệu tham khảo'
        };
        if (translationMap[rest]) {
          if (isChild) {
            return `${translationMap[rest]} (${rest})`;
          } else {
            return `Chương ${num}: ${translationMap[rest]} (${rest})`;
          }
        }
      }
    }
    
    return title;
  }

  const megaTocGrid = document.getElementById('br-mega-toc-grid');
  if (megaTocGrid && chapterFiles.length > 0) {
    // Group pages by folder/chapter and build parent-child structure
    const chapters = [];
    
    const groups = {};
    chapterFiles.forEach((pagePath, index) => {
      let folder = '';
      const parts = pagePath.split('/');
      if (parts.length > 1) {
        folder = parts[0];
      } else {
        folder = 'other';
      }
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push({ pagePath, index });
    });

    Object.keys(groups).forEach(folderName => {
      const pages = groups[folderName];
      if (pages.length === 0) return;

      // Find parent page (introduction or preface or index, or fallback to first page)
      let parentIndex = pages.findIndex(p => p.pagePath.toLowerCase().includes('introduction'));
      if (parentIndex === -1) {
        parentIndex = pages.findIndex(p => p.pagePath.toLowerCase().includes('preface'));
      }
      if (parentIndex === -1) {
        parentIndex = pages.findIndex(p => p.pagePath.toLowerCase().includes('index.html'));
      }
      if (parentIndex === -1) {
        parentIndex = 0;
      }

      const parentPage = pages[parentIndex];
      const childrenPages = pages.filter((_, i) => i !== parentIndex);

      chapters.push({
        folderName,
        parent: parentPage,
        children: childrenPages
      });
    });

    function formatGroupHeader(folderName) {
      if (folderName === '_book-level') return 'Mở đầu';
      if (folderName.startsWith('chapter-')) {
        const num = folderName.split('-')[1];
        return `Chương ${num}`;
      }
      return folderName.charAt(0).toUpperCase() + folderName.slice(1);
    }

    // Render chapters into the grid with parent-child structure
    chapters.forEach(chapter => {
      const groupEl = document.createElement('div');
      groupEl.className = 'br-mega-toc-group';

      const headerEl = document.createElement('div');
      headerEl.className = 'br-mega-toc-group-header';
      headerEl.textContent = formatGroupHeader(chapter.folderName);
      groupEl.appendChild(headerEl);

      const pagesContainer = document.createElement('div');
      pagesContainer.className = 'br-mega-toc-group-pages';

      // 1. Render Parent Item
      const parentEl = document.createElement('div');
      parentEl.className = 'br-mega-toc-page-item br-mega-toc-parent-item';
      if (chapter.parent.index === currentIndex) {
        parentEl.classList.add('br-mega-toc-active');
      }
      parentEl.textContent = formatPageTitle(chapter.parent.pagePath, false);
      parentEl.addEventListener('click', () => {
        navigateTo(chapter.parent.pagePath);
      });
      pagesContainer.appendChild(parentEl);

      // 2. Render Child Items (if any)
      if (chapter.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'br-mega-toc-children-container';
        
        chapter.children.forEach(childPage => {
          const childEl = document.createElement('div');
          childEl.className = 'br-mega-toc-page-item br-mega-toc-child-item';
          if (childPage.index === currentIndex) {
            childEl.classList.add('br-mega-toc-active');
          }
          childEl.textContent = formatPageTitle(childPage.pagePath, true);
          childEl.addEventListener('click', () => {
            navigateTo(childPage.pagePath);
          });
          childrenContainer.appendChild(childEl);
        });
        
        pagesContainer.appendChild(childrenContainer);
      }

      groupEl.appendChild(pagesContainer);
      megaTocGrid.appendChild(groupEl);
    });
  }

  // 5. Event Delegation for Hovers
  mainContent.addEventListener('mouseover', (e) => {
    
    // Handle term hover
    const termEl = e.target.closest('[data-type="term"]');
    if (termEl) {
      let englishTermText = '';
      let vnText = '';
      const termId = termEl.getAttribute('id');

      if (isEnMode && termEl.closest('.eng')) {
         englishTermText = termEl.textContent.trim().toLowerCase();
      } else if (!isEnMode && termEl.closest('.vn')) {
         vnText = termEl.textContent.trim().toLowerCase();
         
         const parentVn = termEl.closest('.vn.visible');
         if (parentVn) {
             const vnId = parentVn.id;
             if (vnId && vnId.endsWith('-vn')) {
                 const engId = vnId.replace('-vn', '');
                 const engEl = document.getElementById(engId);
                 if (engEl) {
                     const engTermEl = engEl.querySelector(`[id="${termId}"]`) || engEl.querySelector(`[data-type="term"]`);
                     if (engTermEl) englishTermText = engTermEl.textContent.trim().toLowerCase();
                 }
             }
         }
         if (!englishTermText && termId) {
             const all = document.querySelectorAll(`[id="${termId}"]`);
             if (all.length > 0) {
                 englishTermText = all[0].textContent.trim().toLowerCase(); 
             }
         }
      }

      if (englishTermText || vnText) {
          let matchedTerm = null;
          if (englishTermText) {
            matchedTerm = glossaryData.find(item => item.key && item.key.toLowerCase() === englishTermText);
          }
          if (!matchedTerm) {
             matchedTerm = glossaryData.find(item => 
                (item.translation && item.translation.toLowerCase() === vnText) || 
                (item.key && item.key.toLowerCase() === vnText) ||
                (englishTermText && item.key && item.key.toLowerCase() === englishTermText)
             );
          }

          if (matchedTerm) {
            tooltip.innerHTML = `
              <div class="br-tooltip-title">${matchedTerm.key}</div>
              <div class="br-tooltip-vi">VN: ${matchedTerm.translation}</div>
              <div class="br-tooltip-desc"><strong>EN:</strong> ${matchedTerm.desc_en || 'N/A'}</div>
              <div class="br-tooltip-desc"><strong>VN:</strong> ${matchedTerm.desc_vi || 'N/A'}</div>
            `;
          } else {
            tooltip.innerHTML = `
              <div class="br-tooltip-title">${englishTermText || vnText}</div>
              <div class="br-tooltip-desc">Không tìm thấy định nghĩa trong từ điển.</div>
            `;
          }

          // Show and position tooltip
          tooltip.style.display = 'block';
          
          const rect = termEl.getBoundingClientRect();
          const tooltipHeight = tooltip.offsetHeight || 120;
          let top = window.scrollY + rect.top - tooltipHeight - 10;
          if (rect.top - tooltipHeight - 10 < 0) {
            top = window.scrollY + rect.bottom + 10;
          }
          let left = window.scrollX + rect.left;
          if (left + 280 > window.innerWidth) {
            left = window.innerWidth - 300;
          }
          tooltip.style.top = top + 'px';
          tooltip.style.left = left + 'px';
      }
    }

    // Handle block hover for translation
    const blockEl = e.target.closest('.vn.visible, .eng.hidden');
    if (blockEl) {
        if (!isEnMode && blockEl.classList.contains('vn')) {
          const vnId = blockEl.getAttribute('id');
          if (vnId && vnId.endsWith('-vn')) {
            const engId = vnId.replace('-vn', '');
            const engEl = document.getElementById(engId);
            if (engEl) engContentPanel.innerHTML = engEl.outerHTML;
            else engContentPanel.innerHTML = "<em>English counterpart not found.</em>";
          } else {
            const prev = blockEl.previousElementSibling;
            if (prev && prev.classList.contains('eng')) engContentPanel.innerHTML = prev.outerHTML;
          }
        } else if (isEnMode && blockEl.classList.contains('eng')) {
          const engId = blockEl.getAttribute('id');
          if (engId && !engId.endsWith('-vn')) {
            const vnId = engId + '-vn';
            const vnEl = document.getElementById(vnId);
            if (vnEl) engContentPanel.innerHTML = vnEl.outerHTML;
            else {
                const next = blockEl.nextElementSibling;
                if (next && next.classList.contains('vn')) engContentPanel.innerHTML = next.outerHTML;
                else engContentPanel.innerHTML = "<em>Vietnamese counterpart not found.</em>";
            }
          } else {
            const next = blockEl.nextElementSibling;
            if (next && next.classList.contains('vn')) engContentPanel.innerHTML = next.outerHTML;
          }
        }
    }
  });

  // Hide tooltip when leaving term
  mainContent.addEventListener('mouseout', (e) => {
    const termEl = e.target.closest('[data-type="term"]');
    if (termEl) {
      tooltip.style.display = 'none';
    }
  });

  // --- Comments Feature Implementation ---
  const pathname = window.location.pathname;
  let bookId = 'entrepreneurship';
  if (pathname.includes('/statistics/')) {
    bookId = 'statistics';
  } else if (pathname.includes('/entrepreneurship/')) {
    bookId = 'entrepreneurship';
  } else {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      bookId = parts[0];
    }
  }

  let pageId = '';
  const bookPrefix = '/' + bookId + '/';
  const prefixIndex = pathname.indexOf(bookPrefix);
  if (prefixIndex !== -1) {
    pageId = pathname.substring(prefixIndex + bookPrefix.length);
  } else {
    pageId = pathname.substring(pathname.lastIndexOf('/') + 1);
  }
  pageId = pageId.replace('.html', '').replace(/\/$/, '');

  window.pageComments = {};
  let activeElementId = null;
  let isCommentsPinned = false;
  let currentHoveredEl = null;

  const commentsApiUrl = `../../api/comments?bookId=${bookId}&pageId=${encodeURIComponent(pageId)}`;

  function highlightElementsWithComments() {
    // Clear old highlights
    const elements = mainContent.querySelectorAll('.br-has-comments');
    elements.forEach(el => el.classList.remove('br-has-comments'));

    // Highlight elements that have at least one comment
    Object.keys(window.pageComments).forEach(id => {
      const list = window.pageComments[id] || [];
      if (list.length > 0) {
        const engEl = document.getElementById(id);
        if (engEl) engEl.classList.add('br-has-comments');
        
        const vnEl = document.getElementById(id + '-vn');
        if (vnEl) vnEl.classList.add('br-has-comments');
      }
    });
  }

  function fetchComments() {
    fetch(commentsApiUrl)
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        if (data.comments) {
          window.pageComments = data.comments;
          if (activeElementId) {
            renderComments(activeElementId);
          }
          highlightElementsWithComments();
        }
      })
      .catch(err => console.error("Error fetching comments:", err));
  }

  // Initial fetch
  fetchComments();

  function getNormalizedElementId(el) {
    if (!el) return null;
    const id = el.getAttribute('id');
    if (!id) return null;
    if (id.endsWith('-vn')) {
      return id.substring(0, id.length - 3);
    }
    return id;
  }

  function renderComments(elementId) {
    const commentsList = document.getElementById('br-comments-list');
    const inputArea = document.getElementById('br-comments-input-area');
    const activeTagLabel = document.getElementById('br-active-tag-label');
    const pinIndicator = document.getElementById('br-pin-indicator');

    if (!commentsList) return;

    activeTagLabel.textContent = `Bình luận (#${elementId})`;
    if (isCommentsPinned) {
      pinIndicator.style.display = 'inline';
    } else {
      pinIndicator.style.display = 'none';
    }

    inputArea.style.display = 'block';

    const list = window.pageComments[elementId] || [];
    if (list.length === 0) {
      commentsList.innerHTML = `<div class="br-comments-empty">Chưa có bình luận nào cho đoạn này. Hãy là người đầu tiên bình luận!</div>`;
    } else {
      commentsList.innerHTML = list.map(c => {
        const date = new Date(c.createdAt || Date.now());
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
        return `
          <div class="br-comment-bubble" data-comment-id="${c.id}">
            <div class="br-comment-meta" style="padding-right: 18px;">
              <span class="br-comment-user">${escapeHTML(c.username)}</span>
              <span class="br-comment-time">${timeString}</span>
            </div>
            <div class="br-comment-text">${escapeHTML(c.text)}</div>
            <button class="br-comment-delete-btn" data-id="${c.id}" title="Xoá bình luận">🗑️</button>
          </div>
        `;
      }).join('');
    }

    commentsList.scrollTop = commentsList.scrollHeight;
  }

  function resetCommentsView() {
    const commentsList = document.getElementById('br-comments-list');
    const inputArea = document.getElementById('br-comments-input-area');
    const activeTagLabel = document.getElementById('br-active-tag-label');
    const pinIndicator = document.getElementById('br-pin-indicator');

    if (activeTagLabel) activeTagLabel.textContent = 'Chọn đoạn văn để bình luận';
    if (pinIndicator) pinIndicator.style.display = 'none';
    if (inputArea) inputArea.style.display = 'none';
    if (commentsList) {
      commentsList.innerHTML = `<div class="br-comments-placeholder">Rê chuột hoặc nhấp vào bất kỳ đoạn văn nào để xem hoặc viết bình luận.</div>`;
    }
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function deleteComment(commentId) {
    fetch(`../../api/comments?id=${commentId}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to delete comment");
        return res.json();
      })
      .then(data => {
        // Find and remove from cache window.pageComments
        Object.keys(window.pageComments).forEach(elementId => {
          const list = window.pageComments[elementId] || [];
          const index = list.findIndex(c => String(c.id) === String(commentId));
          if (index !== -1) {
            list.splice(index, 1);
          }
        });
        
        // Re-render comments for the active element
        if (activeElementId) {
          renderComments(activeElementId);
        }
        
        // Update highlight styling
        highlightElementsWithComments();
      })
      .catch(err => {
        alert("Không thể xoá bình luận. Vui lòng đảm bảo D1 đã được liên kết.");
        console.error(err);
      });
  }

  // Setup event listeners for hover/click on content blocks
  mainContent.addEventListener('mouseover', (e) => {
    let el = e.target;
    let normalizedId = null;

    while (el && el !== mainContent) {
      normalizedId = getNormalizedElementId(el);
      if (normalizedId) break;
      el = el.parentElement;
    }

    if (normalizedId) {
      if (currentHoveredEl && currentHoveredEl !== el) {
        currentHoveredEl.classList.remove('br-comments-hover');
      }
      el.classList.add('br-comments-hover');
      currentHoveredEl = el;

      if (!isCommentsPinned && activeElementId !== normalizedId) {
        activeElementId = normalizedId;
        renderComments(normalizedId);
      }
    }
  });

  mainContent.addEventListener('mouseout', (e) => {
    if (currentHoveredEl && !currentHoveredEl.contains(e.relatedTarget)) {
      currentHoveredEl.classList.remove('br-comments-hover');
      currentHoveredEl = null;

      if (!isCommentsPinned) {
        activeElementId = null;
        resetCommentsView();
      }
    }
  });

  mainContent.addEventListener('click', (e) => {
    let el = e.target;
    let normalizedId = null;

    while (el && el !== mainContent) {
      normalizedId = getNormalizedElementId(el);
      if (normalizedId) break;
      el = el.parentElement;
    }

    if (normalizedId) {
      // Toggle pinning
      if (isCommentsPinned && activeElementId === normalizedId) {
        isCommentsPinned = false;
        el.classList.remove('br-comments-pinned');
        renderComments(normalizedId);
      } else {
        const prevPinned = mainContent.querySelector('.br-comments-pinned');
        if (prevPinned) prevPinned.classList.remove('br-comments-pinned');

        isCommentsPinned = true;
        activeElementId = normalizedId;
        el.classList.add('br-comments-pinned');
        renderComments(normalizedId);
      }
    }
  });

  // Setup form submission
  const submitBtn = document.getElementById('br-comment-submit-btn');
  const usernameInput = document.getElementById('br-comment-username');
  const textInput = document.getElementById('br-comment-text');

  if (usernameInput) {
    usernameInput.value = localStorage.getItem('br_comment_username') || '';
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const username = usernameInput.value.trim() || 'Ẩn danh';
      const text = textInput.value.trim();

      if (!text || !activeElementId) return;

      localStorage.setItem('br_comment_username', username);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi...';

      const postData = {
        bookId,
        pageId,
        elementId: activeElementId,
        username,
        text
      };

      fetch('../../api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to post comment");
          return res.json();
        })
        .then(newComment => {
          if (!window.pageComments[activeElementId]) {
            window.pageComments[activeElementId] = [];
          }
          window.pageComments[activeElementId].push(newComment);
          textInput.value = '';
          renderComments(activeElementId);
          highlightElementsWithComments();
        })
        .catch(err => {
          alert("Không thể gửi bình luận. Vui lòng đảm bảo D1 đã được liên kết.");
          console.error(err);
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Gửi';
        });
    });
  }

  // Setup comment delete delegation
  const commentsListElement = document.getElementById('br-comments-list');
  if (commentsListElement) {
    commentsListElement.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.br-comment-delete-btn');
      if (deleteBtn) {
        const commentId = deleteBtn.getAttribute('data-id');
        if (commentId) {
          deleteComment(commentId);
        }
      }
    });
  }

});
