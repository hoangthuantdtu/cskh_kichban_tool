document.addEventListener('DOMContentLoaded', () => {
    // === CÁC BIẾN TOÀN CỤC (GLOBAL VARIABLES) ===
    let allData = []; // Store all loaded data
    let currentFilteredData = []; // Store data after all filters
    let currentCategory = 'Tất cả'; // Default category

    // === THAY THẾ BẰNG URL CSV CÔNG KHAI CỦA BẠN TỪ GOOGLE SHEETS "PUBLISH TO WEB" ===
    // Đảm bảo URL này là URL thực tế bạn nhận được sau khi "Publish to web" dưới dạng CSV.
    const PUBLIC_GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYoeeeguCiU-4cInfsK76ZOVVHBcDyAkgk3hbQZ1TUQNqCuaa5_uOlnih9N5Iv9Q/pub?gid=20066325&single=true&output=csv';
    // Ví dụ: const PUBLIC_GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYoeeeguCiU-4cInfsK76ZOVVHBcDyAkgk3hbQZ1TUQNqCuaa5_uOlnih9N5Iv9Q/pub?gid=0&single=true&output=csv';
    // ======================================

    const SHEET_NAME_DISPLAY = 'mau_du_lieu_cskh_csv'; // Tên hiển thị của nguồn dữ liệu

    // === DOM ELEMENTS ===
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const loadFromFileSystemBtn = document.getElementById('loadFromFileSystemBtn');
    const googleSignInBtn = document.getElementById('googleSignInBtn'); // Nút Đăng nhập Google (có thể ẩn hoặc loại bỏ nếu không dùng Apps Script Web App nữa)

    const generalSearchInput = document.getElementById('generalSearchInput');
    const clearGeneralSearchBtn = document.getElementById('clearGeneralSearch');
    const countryFilterSelect = document.getElementById('countryFilter');

    const caseNameSearchInput = document.getElementById('caseNameSearch');
    const clearCaseNameSearchBtn = document.getElementById('clearCaseNameSearch');
    const vietnameseContentSearchInput = document.getElementById('vietnameseContentSearch');
    const clearVietnameseContentSearchBtn = document.getElementById('clearVietnameseContentSearch');
    const keywordsSearchInput = document.getElementById('keywordsSearch');
    const clearKeywordsSearchBtn = document.getElementById('clearKeywordsSearch');
    const noteSearchInput = document.getElementById('noteSearch');
    const clearNoteSearchBtn = document.getElementById('clearNoteSearch');

    const customerInfoSearchInput = document.getElementById('customerInfoSearchInput');
    const clearCustomerInfoSearchBtn = document.getElementById('clearCustomerInfoSearch');
    const customerInfoCheckboxes = document.querySelectorAll('.customer-info-checkbox');

    const categoryTabsContainer = document.getElementById('categoryTabs');
    const resultsDisplay = document.getElementById('resultsDisplay');
    const advancedUploadToggle = document.getElementById('advancedUploadToggle');
    const advancedUploadContent = document.querySelector('.file-upload-section .accordion-content');
    const advancedFilterToggle = document.getElementById('advancedFilterToggle');
    const advancedFilterContent = document.querySelector('.filter-options .accordion-content');

    // === CÁC HÀM XỬ LÝ DỮ LIỆU ===

    /**
     * Hiển thị trạng thái tải dữ liệu
     * @param {boolean} show
     */
    function showLoading(show) {
        if (show) {
            resultsDisplay.innerHTML = '<p class="loading-message">Đang tải dữ liệu, vui lòng chờ...</p>';
        } else {
            // Sẽ được cập nhật sau khi applyFilters
        }
    }

    /**
     * Hiển thị popup thông báo
     * @param {string} message
     * @param {boolean} isError
     */
    function showPopup(message, isError = false) {
        const popup = document.createElement('div');
        popup.className = `popup ${isError ? 'error' : ''}`;
        popup.textContent = message;
        document.body.appendChild(popup);

        // Hide after 3 seconds
        setTimeout(() => {
            popup.classList.add('hide');
            popup.addEventListener('transitionend', () => {
                popup.remove();
            }, { once: true });
        }, 3000);
    }

    /**
     * Xử lý file CSV từ chuỗi nội dung
     * @param {string} csvString - Nội dung CSV dưới dạng chuỗi
     * @returns {Promise<Array<Object>>} Promise resolve với mảng dữ liệu hoặc reject nếu lỗi
     */
    function parseCsvString(csvString) {
        return new Promise((resolve, reject) => {
            Papa.parse(csvString, {
                header: true, // Coi hàng đầu tiên là tiêu đề
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length) {
                        console.error("PapaParse errors:", results.errors);
                        reject(new Error("Lỗi khi phân tích cú pháp CSV: " + results.errors[0].message));
                    } else {
                        // Ensure all values are strings for consistent searching
                        const processedData = results.data.map(row => {
                            const newRow = {};
                            for (const key in row) {
                                newRow[key] = row[key] !== undefined && row[key] !== null ? String(row[key]) : '';
                            }
                            return newRow;
                        });
                        resolve(processedData);
                    }
                },
                error: function(err) {
                    reject(err);
                }
            });
        });
    }

    /**
     * Xử lý file Excel/CSV từ File object (dùng cho tải lên từ hệ thống)
     * @param {File} file - Đối tượng File từ input type="file"
     */
    async function processFile(file) {
        showLoading(true);
        fileNameDisplay.textContent = `Đang tải: ${file.name}`;
        showPopup(`Đang xử lý file: ${file.name}...`);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = e.target.result;
                let parsedData = [];

                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    parsedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    // Assuming the first row is headers, convert to object array
                    if (parsedData.length > 0) {
                        const headers = parsedData[0];
                        parsedData = parsedData.slice(1).map(row => {
                            const obj = {};
                            headers.forEach((header, index) => {
                                obj[header] = row[index] !== undefined && row[index] !== null ? String(row[index]) : '';
                            });
                            return obj;
                        });
                    }
                } else if (file.name.endsWith('.csv')) {
                    parsedData = await parseCsvString(data);
                } else {
                    throw new Error('Định dạng file không được hỗ trợ. Vui lòng tải lên file Excel (.xlsx, .xls) hoặc CSV (.csv).');
                }

                allData = parsedData;
                fileNameDisplay.textContent = `Đã tải: ${file.name} (${allData.length} mục)`;
                populateCountryFilter();
                applyFilters();
                showPopup(`Đã tải file "${file.name}" thành công! (${allData.length} mục)`);
            };
            reader.onerror = (e) => {
                throw new Error(`Không thể đọc file: ${e.target.error.name}`);
            };

            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }

        } catch (error) {
            console.error("Error processing file:", error);
            showPopup(`Lỗi khi xử lý file: ${error.message}`, true);
            fileNameDisplay.textContent = 'Lỗi tải file!';
        } finally {
            showLoading(false);
        }
    }


    /**
     * Tải dữ liệu từ Google Sheet công khai (CSV)
     */
    async function loadDataFromPublicGoogleSheet() {
        showLoading(true);
        showPopup('Đang tải dữ liệu từ Google Sheet công khai...');

        try {
            const response = await fetch(PUBLIC_GOOGLE_SHEET_CSV_URL);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
            }

            const csvText = await response.text();
            const data = await parseCsvString(csvText);

            console.log("Data loaded from public Google Sheet:", data);
            allData = data;
            fileNameDisplay.textContent = `Đã tải: ${SHEET_NAME_DISPLAY} (${allData.length} mục)`;
            populateCountryFilter();
            applyFilters();
            showPopup(`Đã tải dữ liệu từ Google Sheet công khai thành công! (${allData.length} mục)`);

        } catch (error) {
            console.error("Error fetching data from public Google Sheet:", error);
            showPopup(`Lỗi khi kết nối Google Sheet công khai: ${error.message || error}. Vui lòng kiểm tra liên kết hoặc kết nối Internet.`, true);
        } finally {
            showLoading(false);
        }
    }


    /**
     * Tải file từ thư mục read_file (từ hệ thống file của web đã deploy)
     * @param {string} fileName - Tên file trong thư mục read_file
     */
    async function loadFileFromDeployedReadDir(fileName) {
        showLoading(true);
        showPopup(`Đang tải file "${fileName}" từ thư mục read_file...`);
        fileNameDisplay.textContent = `Đang tải: ${fileName}`;

        try {
            const response = await fetch(`./read_file/${fileName}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`File "${fileName}" không tìm thấy trong thư mục read_file.`);
                }
                throw new Error(`Lỗi HTTP khi tải file: ${response.status} ${response.statusText}`);
            }

            let parsedData = [];
            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                parsedData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Assuming the first row is headers, convert to object array
                if (parsedData.length > 0) {
                    const headers = parsedData[0];
                    parsedData = parsedData.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index] !== undefined && row[index] !== null ? String(row[index]) : '';
                        });
                        return obj;
                    });
                }

            } else if (fileName.endsWith('.csv')) {
                const csvText = await response.text();
                parsedData = await parseCsvString(csvText);
            } else {
                throw new Error('Định dạng file không được hỗ trợ. Vui lòng tải lên file Excel (.xlsx, .xls) hoặc CSV (.csv).');
            }

            allData = parsedData;
            fileNameDisplay.textContent = `Đã tải: ${fileName} (${allData.length} mục)`;
            populateCountryFilter();
            applyFilters();
            showPopup(`Đã tải file "${fileName}" thành công! (${allData.length} mục)`);

        } catch (error) {
            console.error("Error loading file from read_file directory:", error);
            showPopup(`Lỗi khi tải file từ read_file: ${error.message}`, true);
            fileNameDisplay.textContent = 'Lỗi tải file!';
        } finally {
            showLoading(false);
        }
    }


    /**
     * Lọc và hiển thị dữ liệu
     */
    function applyFilters() {
        if (!allData || allData.length === 0) {
            resultsDisplay.innerHTML = '<p class="no-results-message">Không có dữ liệu để hiển thị. Vui lòng tải lên hoặc làm mới dữ liệu.</p>';
            return;
        }

        // Apply category filter
        let filteredByCategory = allData.filter(item => {
            const categoryMatch = currentCategory === 'Tất cả' || (item['Danh mục'] && item['Danh mục'].toLowerCase() === currentCategory.toLowerCase());
            return categoryMatch;
        });

        // Apply text filters and advanced filters
        currentFilteredData = filteredByCategory.filter(item => {
            const generalSearchText = generalSearchInput.value.toLowerCase();
            const caseNameSearchText = caseNameSearchInput.value.toLowerCase();
            const vietnameseContentSearchText = vietnameseContentSearchInput.value.toLowerCase();
            const keywordsSearchText = keywordsSearchInput.value.toLowerCase();
            const noteSearchText = noteSearchInput.value.toLowerCase();
            const customerInfoSearchText = customerInfoSearchInput.value.toLowerCase();

            const selectedCountry = countryFilterSelect.value;
            const countryMatch = selectedCountry === 'Tất cả' || (item['Tên Quốc gia'] && item['Tên Quốc gia'].toLowerCase() === selectedCountry.toLowerCase());

            const generalMatch = !generalSearchText ||
                (item['Tên Case'] && item['Tên Case'].toLowerCase().includes(generalSearchText)) ||
                (item['Danh mục'] && item['Danh mục'].toLowerCase().includes(generalSearchText)) ||
                (item['Tên Quốc gia'] && item['Tên Quốc gia'].toLowerCase().includes(generalSearchText)) ||
                (item['Nội dung tư vấn - câu trả lời Tiếng Việt'] && item['Nội dung tư vấn - câu trả lời Tiếng Việt'].toLowerCase().includes(generalSearchText)) ||
                (item['Nội dung tư vấn - câu trả lời theo Ngôn ngữ quốc gia'] && item['Nội dung tư vấn - câu trả lời theo Ngôn ngữ quốc gia'].toLowerCase().includes(generalSearchText)) ||
                (item['Keywords'] && item['Keywords'].toLowerCase().includes(generalSearchText)) ||
                (item['Ghi chú (text)'] && item['Ghi chú (text)'].toLowerCase().includes(generalSearchText)) ||
                (item['Dữ liệu đầu vào - Thông tin khách hàng'] && item['Dữ liệu đầu vào - Thông tin khách hàng'].toLowerCase().includes(generalSearchText)) ||
                (item['Hướng xử lý'] && item['Hướng xử lý'].toLowerCase().includes(generalSearchText));


            const caseNameMatch = !caseNameSearchText || (item['Tên Case'] && item['Tên Case'].toLowerCase().includes(caseNameSearchText));
            const vietnameseContentMatch = !vietnameseContentSearchText || (item['Nội dung tư vấn - câu trả lời Tiếng Việt'] && item['Nội dung tư vấn - câu trả lời Tiếng Việt'].toLowerCase().includes(vietnameseContentSearchText));
            const keywordsMatch = !keywordsSearchText || (item['Keywords'] && item['Keywords'].toLowerCase().includes(keywordsSearchText));
            const noteMatch = !noteSearchText || (item['Ghi chú (text)'] && item['Ghi chú (text)'].toLowerCase().includes(noteSearchText));

            // Advanced Customer Info Search
            const customerInfoMatch = !customerInfoSearchText || (item['Dữ liệu đầu vào - Thông tin khách hàng'] && item['Dữ liệu đầu vào - Thông tin khách hàng'].toLowerCase().includes(customerInfoSearchText));

            const selectedCustomerInfoFilters = Array.from(customerInfoCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value.toLowerCase());

            const customerInfoAttributeMatch = selectedCustomerInfoFilters.length === 0 ||
                selectedCustomerInfoFilters.some(filterKey => {
                    // Check if the customer info field contains any of the keywords from the selected filter
                    const customerInfoContent = (item['Dữ liệu đầu vào - Thông tin khách hàng'] || '').toLowerCase();
                    return customerInfoContent.includes(filterKey);
                });


            return generalMatch && caseNameMatch && vietnameseContentMatch && keywordsMatch && noteMatch && countryMatch && customerInfoMatch && customerInfoAttributeMatch;
        });

        renderResults(currentFilteredData);
        populateCategoryTabs();
    }


    /**
     * Render results to the display area
     * @param {Array<Object>} dataToRender - Array of objects to render
     */
    function renderResults(dataToRender) {
        if (dataToRender.length === 0) {
            resultsDisplay.innerHTML = '<p class="no-results-message">Không tìm thấy kết quả phù hợp.</p>';
            return;
        }

        resultsDisplay.innerHTML = ''; // Clear previous results

        dataToRender.forEach(item => {
            const card = document.createElement('div');
            card.className = 'case-card';

            const countryFlagUrl = item['Cờ quốc huy (url)'] || 'https://via.placeholder.com/20x15?text=NoFlag';
            const countryName = item['Tên Quốc gia'] || 'Không rõ';

            card.innerHTML = `
                <div class="row-top">
                    <h3 class="case-name">${item['Tên Case'] || 'Chưa có tên Case'}</h3>
                    <div class="row-category-country">
                        <span class="case-category tag category">${item['Danh mục'] || 'Chưa phân loại'}</span>
                        <div class="country-display">
                            <img src="${countryFlagUrl}" alt="${countryName} flag" class="country-flag" onerror="this.onerror=null;this.src='https://via.placeholder.com/20x15?text=NoFlag';">
                            <span class="country-name">${countryName}</span>
                        </div>
                    </div>
                </div>

                <div class="case-details">
                    <p><strong>Nội dung TV (Tiếng Việt):</strong></p>
                    <textarea class="content-textarea" readonly>${item['Nội dung tư vấn - câu trả lời Tiếng Việt'] || 'Không có nội dung'}</textarea>
                    <button class="btn copy-btn" data-target="vietnameseContent">Sao chép</button>

                    <p><strong>Nội dung TV (Ngôn ngữ QG):</strong></p>
                    <textarea class="content-textarea" readonly>${item['Nội dung tư vấn - câu trả lời theo Ngôn ngữ quốc gia'] || 'Không có nội dung'}</textarea>
                    <button class="btn copy-btn" data-target="countryContent">Sao chép</button>

                    <p><strong>Hướng xử lý:</strong> ${item['Hướng xử lý'] || 'Không có hướng xử lý'}</p>
                    <p><strong>Dữ liệu đầu vào:</strong> ${item['Dữ liệu đầu vào - Thông tin khách hàng'] || 'Không có dữ liệu'}</p>
                    <p><strong>Keywords:</strong> ${item['Keywords'] || 'Không có keywords'}</p>
                    <p><strong>Ghi chú:</strong> ${item['Ghi chú (text)'] || 'Không có ghi chú'}
                        ${item['Ghi chú (link)'] ? `<a href="${item['Ghi chú (link)']}" target="_blank" class="link-btn">Xem link</a>` : ''}
                    </p>
                    <p><strong>Liên hệ nội bộ:</strong> ${item['Liên hệ nội bộ (text)'] || 'Không có thông tin'}
                        ${item['Liên hệ nội bộ (Link)'] ? `<a href="${item['Liên hệ nội bộ (Link)']}" target="_blank" class="link-btn">Xem link</a>` : ''}
                    </p>
                </div>

                <div class="row-buttons">
                    <button class="btn info-btn toggle-details">Xem chi tiết</button>
                    <button class="btn primary copy-all-btn">Sao chép toàn bộ</button>
                </div>
            `;

            resultsDisplay.appendChild(card);
        });

        // Add event listeners for copy and toggle buttons
        addCardEventListeners();
    }

    /**
     * Add event listeners to copy and toggle buttons on rendered cards
     */
    function addCardEventListeners() {
        document.querySelectorAll('.copy-btn').forEach(button => {
            button.onclick = (e) => {
                const targetType = e.target.dataset.target;
                const textarea = e.target.previousElementSibling;
                if (textarea) {
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        showPopup('Đã sao chép nội dung!', false);
                    }).catch(err => {
                        console.error('Lỗi khi sao chép:', err);
                        showPopup('Không thể sao chép nội dung.', true);
                    });
                }
            };
        });

        document.querySelectorAll('.toggle-details').forEach(button => {
            button.onclick = (e) => {
                const card = e.target.closest('.case-card');
                const details = card.querySelector('.case-details');
                details.classList.toggle('show');
                if (details.classList.contains('show')) {
                    e.target.textContent = 'Thu gọn';
                } else {
                    e.target.textContent = 'Xem chi tiết';
                }
            };
        });

        document.querySelectorAll('.copy-all-btn').forEach(button => {
            button.onclick = (e) => {
                const card = e.target.closest('.case-card');
                const caseName = card.querySelector('.case-name').textContent.trim();
                const category = card.querySelector('.case-category').textContent.trim();
                const country = card.querySelector('.country-name').textContent.trim();
                const vietnameseContent = card.querySelector('textarea[data-target="vietnameseContent"]').value.trim();
                const countryContent = card.querySelector('textarea[data-target="countryContent"]').value.trim();
                const detailsText = Array.from(card.querySelectorAll('.case-details p'))
                                        .map(p => p.textContent.trim())
                                        .join('\n'); // Join other text details

                // Combine all relevant information
                const allContent = `Tên Case: ${caseName}\nDanh mục: ${category}\nQuốc gia: ${country}\n\nNội dung TV (Tiếng Việt):\n${vietnameseContent}\n\nNội dung TV (Ngôn ngữ QG):\n${countryContent}\n\n${detailsText}`;

                navigator.clipboard.writeText(allContent).then(() => {
                    showPopup('Đã sao chép toàn bộ nội dung Case!', false);
                }).catch(err => {
                    console.error('Lỗi khi sao chép toàn bộ:', err);
                    showPopup('Không thể sao chép toàn bộ nội dung.', true);
                });
            };
        });
    }


    /**
     * Populate Country Filter dropdown based on loaded data
     */
    function populateCountryFilter() {
        const countries = new Set(allData.map(item => item['Tên Quốc gia']).filter(Boolean));
        countryFilterSelect.innerHTML = '<option value="Tất cả">Tất cả Quốc gia</option>';
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countryFilterSelect.appendChild(option);
        });
    }

    /**
     * Populate category tabs dynamically
     */
    function populateCategoryTabs() {
        const categories = new Set(allData.map(item => item['Danh mục']).filter(Boolean));
        categoryTabsContainer.innerHTML = '<button class="tab-button active" data-category="Tất cả">Tất cả</button>';
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'tab-button';
            button.dataset.category = category;
            button.textContent = category;
            categoryTabsContainer.appendChild(button);
        });

        // Add event listeners to new tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentCategory = e.target.dataset.category;
                applyFilters();
            });
        });
    }

    /**
     * Initial data load on page load
     */
    function loadInitialData() {
        // Tải dữ liệu từ Google Sheet công khai khi trang tải lần đầu
        loadDataFromPublicGoogleSheet();
    }


    // === EVENT LISTENERS ===
    fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });

    refreshDataBtn.addEventListener('click', loadDataFromPublicGoogleSheet); // Thay đổi ở đây

    // Bổ sung event listener cho loadFromFileSystemBtn (Đọc file từ thư mục đã deploy)
    loadFromFileSystemBtn.addEventListener('click', () => {
        // Bạn cần xác định tên file Excel/CSV mặc định trong thư mục read_file ở đây
        const defaultFileName = 'mau_du_lieu_cskh.xlsx'; // Hoặc 'data.csv', tùy thuộc vào file của bạn
        loadFileFromDeployedReadDir(defaultFileName);
    });

    // Google Sign-In Button - CÓ THỂ BẠN KHÔNG CẦN NÚT NÀY NỮA NẾU CHỈ ĐỌC CSV CÔNG KHAI
    // googleSignInBtn.addEventListener('click', loadDataFromGoogleSheet); // Nếu không dùng Apps Script Web App nữa, hãy comment/xóa dòng này


    // Search & Filter Event Listeners
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


    // Clear Buttons
    clearGeneralSearchBtn.addEventListener('click', () => { generalSearchInput.value = ''; applyFilters(); });
    clearCaseNameSearchBtn.addEventListener('click', () => { caseNameSearchInput.value = ''; applyFilters(); });
    clearVietnameseContentSearchBtn.addEventListener('click', () => { vietnameseContentSearchInput.value = ''; applyFilters(); });
    clearKeywordsSearchBtn.addEventListener('click', () => { keywordsSearchInput.value = ''; applyFilters(); });
    clearNoteSearchBtn.addEventListener('click', () => { noteSearchInput.value = ''; applyFilters(); });
    clearCustomerInfoSearchBtn.addEventListener('click', () => { customerInfoSearchInput.value = ''; applyFilters(); });


    // Accordion Toggles
    advancedUploadToggle.addEventListener('click', () => {
        advancedUploadContent.classList.toggle('show');
        advancedUploadToggle.classList.toggle('active');
    });

    advancedFilterToggle.addEventListener('click', () => {
        advancedFilterContent.classList.toggle('show');
        advancedFilterToggle.classList.toggle('active');
    });

    // Initial load when DOM is ready
    loadInitialData();
});