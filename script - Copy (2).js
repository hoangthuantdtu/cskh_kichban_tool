document.addEventListener('DOMContentLoaded', () => {
    // === CÁC BIẾN TOÀN CỤC (GLOBAL VARIABLES) ===
    let allData = []; // Store all loaded dataa
    let currentFilteredData = []; // Store data after all filters
    let currentCategory = 'Tất cả'; 

    // === THAY THẾ BẰNG URL WEB APP CỦA BẠN ===
    // Đảm bảo URL này là URL thực tế từ việc triển khai Google Apps Script Web App của bạn
    // Ví dụ: const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw79wBYg9mgen-yvXmHq-dwAYwOElN7Agb9vHo9me4uOPidyaWnbLqmVzTd1T-rLEz8Xg/exec';
    const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx7D4uJuONbLnj8enNLcjSEFEBCWwXe8aepf9pXO8PCVG8zAWjkA13w_mk7MezZh8o/exec'; // VUI LÒNG DÁN URL CỦA BẠN VÀO ĐÂY
    // ======================================

    const SHEET_NAME_DISPLAY = 'mau_du_lieu_cskh'; // Tên hiển thị của Google Sheet

    let isAuthenticatedWithGoogle = false; // Track Google login status

    // === DOM ELEMENTS ===
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const loadFromFileSystemBtn = document.getElementById('loadFromFileSystemBtn');
    const googleSignInBtn = document.getElementById('googleSignInBtn'); // Nút Đăng nhập Google

    const generalSearchInput = document.getElementById('generalSearchInput');
    const clearGeneralSearchBtn = document.getElementById('clearGeneralSearch'); // Đã sửa tên biến
    const countryFilterSelect = document.getElementById('countryFilter');
    const categoryTabsContainer = document.getElementById('categoryTabs');

    const caseNameSearchInput = document.getElementById('caseNameSearch');
    const clearCaseNameSearchBtn = document.getElementById('clearCaseNameSearch'); // Đã sửa tên biến
    const vietnameseContentSearchInput = document.getElementById('vietnameseContentSearch');
    const clearVietnameseContentSearchBtn = document.getElementById('clearVietnameseContentSearch'); // Đã sửa tên biến
    const keywordsSearchInput = document.getElementById('keywordsSearch');
    const clearKeywordsSearchBtn = document.getElementById('clearKeywordsSearch'); // Đã sửa tên biến
    const noteSearchInput = document.getElementById('noteSearch');
    const clearNoteSearchBtn = document.getElementById('clearNoteSearch'); // Đã sửa tên biến

    const customerInfoSearchInput = document.getElementById('customerInfoSearchInput');
    const clearCustomerInfoSearchBtn = document.getElementById('clearCustomerInfoSearch'); // Đã sửa tên biến
    const customerInfoCheckboxes = document.querySelectorAll('.filter-group input[type="checkbox"]');

    const resultsDisplay = document.getElementById('resultsDisplay');
    const caseCountDisplay = document.getElementById('caseCountDisplay'); // Đảm bảo phần tử này có trong HTML
    const caseTotalDisplay = document.getElementById('caseTotalDisplay'); // Đảm bảo phần tử này có trong HTML

    const advancedUploadToggle = document.getElementById('advancedUploadToggle');
    const advancedUploadContent = document.querySelector('.accordion-content'); // Lấy nội dung thực tế
    const advancedFilterToggle = document.getElementById('advancedFilterToggle');
    const advancedFilterContent = document.getElementById('advancedFilterContent');

    // === HELPER FUNCTIONS ===

    // Function to parse Excel or CSV file
    async function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = event.target.result;
                    let parsedData;

                    if (file.name.endsWith('.csv')) {
                        // Use PapaParse for CSV
                        parsedData = Papa.parse(data, {
                            header: true,
                            skipEmptyLines: true,
                        }).data;
                    } else {
                        // Use XLSX for Excel
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        parsedData = XLSX.utils.sheet_to_json(worksheet);
                    }
                    resolve(parsedData);
                } catch (e) {
                    console.error('Error parsing file:', e);
                    reject(e);
                }
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsBinaryString(file);
        });
    }

    // Function to load data from a local file path
    async function loadFileFromPath(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                // If the default file doesn't exist, it's not an error for initial load
                console.warn(`Default local file not found or could not be loaded: ${path}`);
                return [];
            }
            const blob = await response.blob();
            // Create a File object from Blob for parseFile
            const file = new File([blob], path.split('/').pop(), { type: blob.type });
            return await parseFile(file);
        } catch (error) {
            console.error('Error loading file from path:', error);
            return [];
        }
    }

    // Populate Country Filter
    function populateCountryFilter() {
        const countries = [...new Set(allData.map(item => item['Tên Quốc gia']).filter(Boolean))].sort();
        countryFilterSelect.innerHTML = '<option value="Tất cả">Tất cả Quốc gia</option>';
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countryFilterSelect.appendChild(option);
        });
    }

    // Populate Category Tabs
    function populateCategoryTabs() {
        const categories = [...new Set(allData.map(item => item['Danh mục']).filter(Boolean))].sort();
        categoryTabsContainer.innerHTML = ''; // Clear previous tabs

        // Add "Tất cả" tab
        const allTab = document.createElement('button');
        allTab.classList.add('category-tab');
        allTab.textContent = 'Tất cả';
        allTab.dataset.category = 'Tất cả';
        if (currentCategory === 'Tất cả') {
            allTab.classList.add('active');
        }
        allTab.addEventListener('click', () => {
            currentCategory = 'Tất cả';
            updateCategoryTabs();
            applyFilters();
        });
        categoryTabsContainer.appendChild(allTab);

        // Add other category tabs
        categories.forEach(category => {
            const tab = document.createElement('button');
            tab.classList.add('category-tab');
            tab.textContent = category;
            tab.dataset.category = category;
            if (currentCategory === category) {
                tab.classList.add('active');
            }
            tab.addEventListener('click', () => {
                currentCategory = category;
                updateCategoryTabs();
                applyFilters();
            });
            categoryTabsContainer.appendChild(tab);
        });
    }

    // Update active category tab
    function updateCategoryTabs() {
        document.querySelectorAll('.category-tab').forEach(tab => {
            if (tab.dataset.category === currentCategory) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    // Apply all filters and render results
    function applyFilters() {
        let filtered = allData;

        // Category Filter
        if (currentCategory !== 'Tất cả') {
            filtered = filtered.filter(item => item['Danh mục'] === currentCategory);
        }

        // Country Filter
        const selectedCountry = countryFilterSelect.value;
        if (selectedCountry !== 'Tất cả') {
            filtered = filtered.filter(item => item['Tên Quốc gia'] === selectedCountry);
        }

        // General Search
        const generalSearchTerm = generalSearchInput.value.toLowerCase();
        if (generalSearchTerm) {
            filtered = filtered.filter(item =>
                Object.values(item).some(value =>
                    String(value).toLowerCase().includes(generalSearchTerm)
                )
            );
        }

        // Specific Search Fields
        const caseNameTerm = caseNameSearchInput.value.toLowerCase();
        if (caseNameTerm) {
            filtered = filtered.filter(item =>
                item['Tên Case'] && String(item['Tên Case']).toLowerCase().includes(caseNameTerm)
            );
        }

        const vietnameseContentTerm = vietnameseContentSearchInput.value.toLowerCase();
        if (vietnameseContentTerm) {
            filtered = filtered.filter(item =>
                item['Nội dung tư vấn - câu trả lời Tiếng Việt'] &&
                String(item['Nội dung tư vấn - câu trả lời Tiếng Việt']).toLowerCase().includes(vietnameseContentTerm)
            );
        }

        const keywordsTerm = keywordsSearchInput.value.toLowerCase();
        if (keywordsTerm) {
            filtered = filtered.filter(item =>
                item['Keywords'] && String(item['Keywords']).toLowerCase().includes(keywordsTerm)
            );
        }

        const noteTerm = noteSearchInput.value.toLowerCase();
        if (noteTerm) {
            filtered = filtered.filter(item =>
                item['Ghi chú (text)'] && String(item['Ghi chú (text)']).toLowerCase().includes(noteTerm)
            );
        }

        // Customer Info Search and Filter
        const customerInfoTerm = customerInfoSearchInput.value.toLowerCase();
        const selectedCustomerInfoFilters = Array.from(customerInfoCheckboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value.toLowerCase());

        if (customerInfoTerm || selectedCustomerInfoFilters.length > 0) {
            filtered = filtered.filter(item => {
                const customerInfo = String(item['Dữ liệu đầu vào - Thông tin khách hàng'] || '').toLowerCase();
                const matchesSearch = customerInfoTerm ? customerInfo.includes(customerInfoTerm) : true;

                const matchesFilters = selectedCustomerInfoFilters.length > 0 ?
                    selectedCustomerInfoFilters.some(filter => customerInfo.includes(filter)) : true;

                return matchesSearch && matchesFilters;
            });
        }

        currentFilteredData = filtered;
        renderResults();
    }

    // Render results to the display area
    function renderResults() {
        resultsDisplay.innerHTML = ''; // Clear previous results
        // Kiểm tra sự tồn tại của các phần tử trước khi truy cập
        if (caseCountDisplay) {
            caseCountDisplay.textContent = currentFilteredData.length;
        }
        if (caseTotalDisplay) {
            caseTotalDisplay.textContent = allData.length;
        }

        if (currentFilteredData.length === 0) {
            resultsDisplay.innerHTML = '<p class="no-results-message">Không tìm thấy kết quả nào phù hợp.</p>';
            return;
        }

        currentFilteredData.forEach((item, index) => {
            const card = document.createElement('div');
            card.classList.add('case-card');

            // Format Ghi chú (text) and (link)
            const ghiChuText = item['Ghi chú (text)'] || '';
            const ghiChuLink = item['Ghi chú (link)'] || '';
            let ghiChuHtml = '';
            if (ghiChuText) {
                ghiChuHtml += `<p><strong>Ghi chú:</strong> ${ghiChuText}</p>`;
            }
            if (ghiChuLink) {
                ghiChuHtml += `<p><a href="${ghiChuLink}" target="_blank" class="btn btn-info">🔗 Xem Ghi chú (Link)</a></p>`;
            }

            // Format Liên hệ nội bộ (text) and (link)
            const lienHeNoiBoText = item['Liên hệ nội bộ (text)'] || '';
            const lienHeNoiBoLink = item['Liên hệ nội bộ (Link)'] || '';
            let lienHeNoiBoHtml = '';
            if (lienHeNoiBoText) {
                lienHeNoiBoHtml += `<p><strong>Liên hệ nội bộ:</strong> ${lienHeNoiBoText}</p>`;
            }
            if (lienHeNoiBoLink) {
                lienHeNoiBoHtml += `<p><a href="${lienHeNoiBoLink}" target="_blank" class="btn btn-secondary">📞 Liên hệ nội bộ (Link)</a></p>`;
            }


            card.innerHTML = `
                <div class="row-meta">
                    <span class="case-id">#${item['STT'] || 'N/A'}</span>
                    <span class="case-name">${item['Tên Case'] || 'Chưa có tên'}</span>
                </div>
                <div class="row-category-country">
                    <span class="category-tag">${item['Danh mục'] || 'Chưa phân loại'}</span>
                    <div class="country-display">
                        ${item['Cờ quốc huy (url)'] ? `<img src="${item['Cờ quốc huy (url)']}" alt="${item['Tên Quốc gia'] || 'Quốc gia'}" class="country-flag">` : ''}
                        <span>${item['Tên Quốc gia'] || 'Chưa xác định'}</span>
                    </div>
                </div>
                <div class="row-content">
                    <div class="content-item">
                        <strong>Nội dung Tiếng Việt:</strong>
                        <textarea readonly>${item['Nội dung tư vấn - câu trả lời Tiếng Việt'] || ''}</textarea>
                        <button class="btn btn-copy" data-target="vietnameseContent">Sao chép</button>
                    </div>
                    <div class="content-item">
                        <strong>Nội dung Ngôn ngữ quốc gia:</strong>
                        <textarea readonly>${item['Nội dung tư vấn - câu trả lời theo Ngôn ngữ quốc gia'] || ''}</textarea>
                        <button class="btn btn-copy" data-target="nationalContent">Sao chép</button>
                    </div>
                </div>
                <div class="row-details">
                    <p><strong>Hướng xử lý:</strong> ${item['Hướng xử lý'] || 'Chưa có'}</p>
                    <p><strong>Dữ liệu đầu vào:</strong> ${item['Dữ liệu đầu vào - Thông tin khách hàng'] || 'Chưa có'}</p>
                    <p><strong>Keywords:</strong> ${item['Keywords'] || 'Chưa có'}</p>
                </div>
                <div class="row-notes">
                    ${ghiChuHtml}
                    ${lienHeNoiBoHtml}
                </div>
                <div class="row-buttons">
                    <button class="btn btn-primary btn-copy-all">Sao chép tất cả nội dung</button>
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLSclK-P8dKz24GzP0u5bY2X5t_uR7_vX8g4nQ5k_lF3_g6N8A/viewform?usp=sf_link" target="_blank" class="btn btn-success">Góp ý/Chỉnh sửa</a>
                </div>
            `;
            resultsDisplay.appendChild(card);
        });

        addCopyEventListeners();
        addCopyAllEventListeners();
    }

    // Add event listeners for copy buttons
    function addCopyEventListeners() {
        document.querySelectorAll('.btn-copy').forEach(button => {
            button.addEventListener('click', (e) => {
                // Lấy textarea tương ứng thông qua cấu trúc DOM
                const textarea = e.target.closest('.content-item').querySelector('textarea');
                if (textarea) {
                    textarea.select();
                    document.execCommand('copy');
                    // Optional: Provide feedback to the user
                    const originalText = button.textContent;
                    button.textContent = 'Đã sao chép!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 1500);
                }
            });
        });
    }

    // Add event listeners for copy all button
    function addCopyAllEventListeners() {
        document.querySelectorAll('.btn-copy-all').forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('.case-card');
                const vietnameseContent = card.querySelector('.content-item textarea[data-target="vietnameseContent"]') ? card.querySelector('.content-item textarea[data-target="vietnameseContent"]').value : '';
                const nationalContent = card.querySelector('.content-item textarea[data-target="nationalContent"]') ? card.querySelector('.content-item textarea[data-target="nationalContent"]').value : '';
                const huongXuLy = card.querySelector('.row-details p:nth-child(1)') ? card.querySelector('.row-details p:nth-child(1)').textContent.replace('Hướng xử lý:', '').trim() : '';
                const duLieuDauVao = card.querySelector('.row-details p:nth-child(2)') ? card.querySelector('.row-details p:nth-child(2)').textContent.replace('Dữ liệu đầu vào:', '').trim() : '';
                const keywords = card.querySelector('.row-details p:nth-child(3)') ? card.querySelector('.row-details p:nth-child(3)').textContent.replace('Keywords:', '').trim() : '';
                const ghiChuText = card.querySelector('.row-notes p:nth-child(1)') ? card.querySelector('.row-notes p:nth-child(1)').textContent.replace('Ghi chú:', '').trim() : '';
                const ghiChuLink = card.querySelector('.row-notes a.btn-info') ? card.querySelector('.row-notes a.btn-info').href : '';
                const lienHeNoiBoText = card.querySelector('.row-notes p:nth-child(2)') ? card.querySelector('.row-notes p:nth-child(2)').textContent.replace('Liên hệ nội bộ:', '').trim() : '';
                const lienHeNoiBoLink = card.querySelector('.row-notes a.btn-secondary') ? card.querySelector('.row-notes a.btn-secondary').href : '';

                const textToCopy = `
Tên Case: ${card.querySelector('.case-name').textContent.trim()}
Danh mục: ${card.querySelector('.category-tag').textContent.trim()}
Quốc gia: ${card.querySelector('.country-display span').textContent.trim()}

Nội dung Tiếng Việt:
${vietnameseContent}

Nội dung Ngôn ngữ quốc gia:
${nationalContent}

Hướng xử lý: ${huongXuLy}
Dữ liệu đầu vào: ${duLieuDauVao}
Keywords: ${keywords}
${ghiChuText ? `Ghi chú: ${ghiChuText}` : ''}
${ghiChuLink ? `Ghi chú (Link): ${ghiChuLink}` : ''}
${lienHeNoiBoText ? `Liên hệ nội bộ: ${lienHeNoiBoText}` : ''}
${lienHeNoiBoLink ? `Liên hệ nội bộ (Link): ${lienHeNoiBoLink}` : ''}
                `.trim();

                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = button.textContent;
                    button.textContent = 'Đã sao chép tất cả!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 1500);
                }).catch(err => {
                    console.error('Không thể sao chép văn bản: ', err);
                    alert('Lỗi khi sao chép nội dung.');
                });
            });
        });
    }

    // === MAIN LOAD FUNCTIONS ===

    // Hàm để tải dữ liệu ban đầu (ưu tiên file cục bộ hoặc Google Sheet)
    async function loadInitialData() {
        resultsDisplay.innerHTML = '<p class="no-results-message">Đang tải dữ liệu, vui lòng chờ...</p>';

        try {
            // Tải file cục bộ mặc định
            const defaultFilePath = './read_file/mau_du_lieu_cskh.xlsx';
            const data = await loadFileFromPath(defaultFilePath);

            if (data.length > 0) {
                allData = data;
                populateCountryFilter();
                populateCategoryTabs();
                applyFilters();
                fileNameDisplay.textContent = `Đã tải: ${defaultFilePath.split('/').pop()}`;
                console.log("Dữ liệu đã tải từ file cục bộ.");
            } else {
                resultsDisplay.innerHTML = '<p class="no-results-message">Không có dữ liệu trong file mặc định hoặc file trống. Vui lòng đăng nhập Google để tải từ Sheet hoặc tải lên file.</p>';
                fileNameDisplay.textContent = 'Chưa có file nào được tải.';
            }

            // Cập nhật trạng thái hiển thị của các nút
            updateUiForAuthStatus();

        } catch (error) {
            console.error('Error loading initial data:', error);
            resultsDisplay.innerHTML = '<p class="no-results-message">Lỗi khi tải dữ liệu. Vui lòng kiểm tra console hoặc thử lại.</p>';
            fileNameDisplay.textContent = 'Lỗi tải dữ liệu.';
        }
    }

    // Hàm để tải dữ liệu từ Google Apps Script Web App
    async function loadDataFromGoogleSheet() {
        resultsDisplay.innerHTML = '<p class="no-results-message">Đang tải dữ liệu từ Google Sheet, vui lòng chờ...</p>';
        fileNameDisplay.textContent = `Đang kết nối đến Google Sheet...`;

        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL);
            if (!response.ok) {
                // Lưu ý: Apps Script thường trả về 200 OK ngay cả khi có lỗi bên trong.
                // Lỗi HTTP status thường chỉ xảy ra khi URL sai hoàn toàn hoặc mạng có vấn đề.
                // Lỗi CORS sẽ hiển thị trong console (như bạn thấy) chứ không làm response.ok là false.
                throw new Error(`HTTP Status: ${response.status}. Có thể không tiếp cận được Google Apps Script.`);
            }
            const data = await response.json(); // Phải luôn cố gắng đọc JSON

            if (data.error) {
                // Apps Script đã trả về lỗi trong JSON body
                alert('Lỗi khi tải dữ liệu từ Google Sheet: ' + data.details + '\nVui lòng đảm bảo bạn đã cấp quyền cho ứng dụng bằng cách mở trực tiếp URL Web App trong trình duyệt một lần.');
                console.error('Error from Google Apps Script:', data.details);
                resultsDisplay.innerHTML = '<p class="no-results-message">Lỗi khi tải dữ liệu từ Google Sheet. Vui lòng thử lại.</p>';
                allData = [];
                isAuthenticatedWithGoogle = false; // Đánh dấu là chưa xác thực
            } else if (data.length > 0) {
                allData = data;
                populateCountryFilter();
                populateCategoryTabs();
                applyFilters();
                fileNameDisplay.textContent = `Đã tải từ Google Sheet: ${SHEET_NAME_DISPLAY}`;
                isAuthenticatedWithGoogle = true; // Đánh dấu đã xác thực thành công
                console.log("Dữ liệu đã tải từ Google Sheet.");
            } else {
                resultsDisplay.innerHTML = '<p class="no-results-message">Google Sheet trống hoặc không có dữ liệu.</p>';
                fileNameDisplay.textContent = `Google Sheet trống: ${SHEET_NAME_DISPLAY}`;
                allData = []; // Đảm bảo allData rỗng nếu sheet trống
                applyFilters(); // Cập nhật hiển thị
                isAuthenticatedWithGoogle = true; // Vẫn coi là đã xác thực, chỉ là sheet trống
            }
            updateUiForAuthStatus(); // Cập nhật giao diện người dùng
        } catch (error) {
            console.error('Error fetching data from Google Apps Script:', error);
            // Kiểm tra cụ thể lỗi CORS
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                alert('Kết nối đến Google Sheet bị chặn bởi CORS policy. Vui lòng cấp quyền cho ứng dụng bằng cách TẮT TẤT CẢ EXTENSION TRÌNH DUYỆT (đặc biệt là VPN) và truy cập trực tiếp URL Web App MỘT LẦN để cấp quyền:\n\n' + APPS_SCRIPT_WEB_APP_URL);
            } else if (error.name === 'AbortError') {
                // Xử lý khi yêu cầu bị hủy (ví dụ: người dùng đóng tab)
                console.warn('Fetch request was aborted.');
            } else {
                alert('Lỗi khi kết nối đến Google Sheet. Vui lòng kiểm tra console hoặc thử lại. Có thể bạn cần cấp quyền cho ứng dụng bằng cách truy cập trực tiếp URL Web App một lần.');
            }
            resultsDisplay.innerHTML = '<p class="no-results-message">Lỗi khi kết nối Google Sheet. </p>';
            fileNameDisplay.textContent = 'Lỗi kết nối Google Sheet.';
            isAuthenticatedWithGoogle = false; // Đánh dấu là chưa xác thực
            updateUiForAuthStatus(); // Cập nhật giao diện người dùng
        }
    }

    // Cập nhật trạng thái hiển thị của các nút dựa trên isAuthenticatedWithGoogle
    function updateUiForAuthStatus() {
        if (isAuthenticatedWithGoogle) {
            googleSignInBtn.textContent = '✅ Đã đăng nhập Google Sheet';
            googleSignInBtn.disabled = true; // Vô hiệu hóa nút sau khi đăng nhập thành công
            refreshDataBtn.textContent = '🔄 Refresh Dữ liệu Google Sheet';
            loadFromFileSystemBtn.style.display = 'none'; // Ẩn nút tải file cục bộ
            // Kiểm tra sự tồn tại của advancedUploadToggle trước khi truy cập .closest
            if (advancedUploadToggle) {
                advancedUploadToggle.closest('.accordion').style.display = 'none'; // Ẩn phần tải lên file trực tiếp
            }
        } else {
            googleSignInBtn.textContent = '🚀 Đăng nhập với Google Sheet';
            googleSignInBtn.disabled = false;
            refreshDataBtn.textContent = '🔄 Refresh Dữ liệu cục bộ';
            loadFromFileSystemBtn.style.display = 'inline-flex';
            // Kiểm tra sự tồn tại của advancedUploadToggle trước khi truy cập .closest
            if (advancedUploadToggle) {
                advancedUploadToggle.closest('.accordion').style.display = 'block'; // Hiển thị lại phần tải lên file trực tiếp
            }
        }
    }


    // === EVENT LISTENERS ===

    // File Input change event
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                fileNameDisplay.textContent = `Đang tải: ${file.name}...`;
                allData = await parseFile(file);
                if (allData.length > 0) {
                    populateCountryFilter();
                    populateCategoryTabs();
                    applyFilters();
                    fileNameDisplay.textContent = `Đã tải: ${file.name}`;
                } else {
                    resultsDisplay.innerHTML = '<p class="no-results-message">File trống hoặc không có dữ liệu.</p>';
                    fileNameDisplay.textContent = `File trống: ${file.name}`;
                }
            } catch (error) {
                console.error('Error loading file:', error);
                resultsDisplay.innerHTML = '<p class="no-results-message">Lỗi khi tải file. Vui lòng kiểm tra định dạng hoặc nội dung.</p>';
                fileNameDisplay.textContent = `Lỗi tải file: ${file.name}`;
            }
        }
    });

    // Load from local file system button
    loadFromFileSystemBtn.addEventListener('click', loadInitialData);

    // Google Sign-In Button
    googleSignInBtn.addEventListener('click', () => {
        loadDataFromGoogleSheet();
    });

    // Refresh Data Button
    refreshDataBtn.addEventListener('click', () => {
        if (isAuthenticatedWithGoogle) {
            loadDataFromGoogleSheet(); // Refresh dữ liệu từ Google Sheet nếu đã đăng nhập
        } else {
            loadInitialData(); // Refresh dữ liệu từ file cục bộ nếu chưa đăng nhập
        }
    });


    // Search and Filter Event Listeners
    generalSearchInput.addEventListener('input', applyFilters);
    countryFilterSelect.addEventListener('change', applyFilters);
    caseNameSearchInput.addEventListener('input', applyFilters);
    vietnameseContentSearchInput.addEventListener('input', applyFilters);
    keywordsSearchInput.addEventListener('input', applyFilters);
    noteSearchInput.addEventListener('input', applyFilters);
    customerInfoSearchInput.addEventListener('input', applyFilters);
    customerInfoCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });


    // Clear Buttons (Đã sửa lại đúng tên biến)
    if (clearGeneralSearchBtn) clearGeneralSearchBtn.addEventListener('click', () => { generalSearchInput.value = ''; applyFilters(); });
    if (clearCaseNameSearchBtn) clearCaseNameSearchBtn.addEventListener('click', () => { caseNameSearchInput.value = ''; applyFilters(); });
    if (clearVietnameseContentSearchBtn) clearVietnameseContentSearchBtn.addEventListener('click', () => { vietnameseContentSearchInput.value = ''; applyFilters(); });
    if (clearKeywordsSearchBtn) clearKeywordsSearchBtn.addEventListener('click', () => { keywordsSearchInput.value = ''; applyFilters(); });
    if (clearNoteSearchBtn) clearNoteSearchBtn.addEventListener('click', () => { noteSearchInput.value = ''; applyFilters(); });
    if (clearCustomerInfoSearchBtn) clearCustomerInfoSearchBtn.addEventListener('click', () => { customerInfoSearchInput.value = ''; applyFilters(); });


    // Accordion Toggles
    if (advancedUploadToggle) { // Thêm kiểm tra null
        advancedUploadToggle.addEventListener('click', () => {
            if (advancedUploadContent) { // Kiểm tra null cho nội dung
                advancedUploadContent.classList.toggle('show');
            }
            advancedUploadToggle.classList.toggle('active');
        });
    }

    if (advancedFilterToggle) { // Thêm kiểm tra null
        advancedFilterToggle.addEventListener('click', () => {
            if (advancedFilterContent) { // Kiểm tra null cho nội dung
                advancedFilterContent.classList.toggle('show');
            }
            advancedFilterToggle.classList.toggle('active');
        });
    }

    // Initial load when DOM is ready
    loadInitialData();
});