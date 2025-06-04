async function highlightText() {
    const url = document.getElementById("urlInput").value.trim();
    const word = document.getElementById("textInput").value.trim();
    const iframe = document.getElementById("previewFrame");
    const statusMessage = document.getElementById("statusMessage");

    // Clear previous status and table
    statusMessage.style.display = "none";
    document.getElementById("locatorTableContainer").innerHTML = "";

    if (!url || !word) {
        showStatus("Please enter both URL and text to highlight.", "error");
        return;
    }

    try {
        showStatus("Loading and processing page...", "info");

        // Use a proxy to avoid CORS issues (you'll need to implement this server-side)
        const proxyUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(
            url
        )}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        let matchCount = 0;

        function walkAndHighlight(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const parent = node.parentNode;
                if (
                    !parent ||
                    parent.tagName === "SCRIPT" ||
                    parent.tagName === "STYLE"
                )
                    return;

                const originalText = node.nodeValue;
                const matches = [...originalText.matchAll(regex)];
                if (matches.length === 0) return;

                matchCount += matches.length;
                const fragments = [];
                let lastIndex = 0;

                for (const match of matches) {
                    const { index } = match;
                    if (index > lastIndex) {
                        fragments.push(
                            document.createTextNode(originalText.slice(lastIndex, index))
                        );
                    }

                    const mark = document.createElement("mark");
                    mark.textContent = match[0];
                    mark.setAttribute("data-highlight-id", matchCount);
                    fragments.push(mark);
                    lastIndex = index + match[0].length;
                }

                if (lastIndex < originalText.length) {
                    fragments.push(
                        document.createTextNode(originalText.slice(lastIndex))
                    );
                }

                const fragmentWrapper = document.createDocumentFragment();
                fragments.forEach((fragment) => fragmentWrapper.appendChild(fragment));
                parent.replaceChild(fragmentWrapper, node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                Array.from(node.childNodes).forEach((child) => walkAndHighlight(child));
            }
        }

        walkAndHighlight(doc.body);

        // Generate the locators table with pagination
        generateLocatorsTable(doc, matchCount);

        // Display the highlighted content in iframe
        iframe.srcdoc = doc.documentElement.outerHTML;
        if (matchCount === 0) {
            showStatus(`No occurrences of "${word}" found.`, "error");
            return;
        }
        showStatus(
            `Successfully highlighted ${matchCount} occurrences of "${word}".`,
            "success"
        );
    } catch (error) {
        console.error("Error:", error);
        showStatus(`Error: ${error.message}`, "error");
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const textInput = document.getElementById("textInput");
    const searchButton = document.getElementById("searchButton"); // if you have a button

    // Trigger on 3+ character input
    textInput.addEventListener(
        "input",
        debounce(() => {
            const word = textInput.value.trim();
            if (word.length >= 3) {
                highlightText();
            }
        }, 300)
    );
    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Optional: Also call when clicking a button (no changes needed if it's already wired up)
    if (searchButton) {
        searchButton.addEventListener("click", () => {
            highlightText();
        });
    }
});

function generateLocatorsTable(doc, totalMatches) {
    const marks = doc.querySelectorAll("mark");
    const container = document.getElementById("locatorTableContainer");

    if (marks.length === 0) {
        container.innerHTML = "<p>No matches found to display.</p>";
        return;
    }

    const allRows = Array.from(marks).map((mark, index) => {
        const parent = mark.parentElement;
        const id = parent?.id || "-";
        const name = parent?.getAttribute("name") || "-";
        const cssPath = getCssPath(parent);
        const fullXpath = getFullXPath(parent);
        const xpath = getXPath(parent);
        const tagName = parent.tagName;
        const type = getElementTypeName(tagName);

        return {
            id: index + 1,
            highlightId: mark.getAttribute("data-highlight-id"),
            elementId: id,
            elementName: name,
            fullXpath,
            xpath,
            cssPath,
            text: mark.textContent,
            type,
        };
    });

    const rowsPerPage = 10;
    let currentPage = 1;
    const totalPages = Math.ceil(allRows.length / rowsPerPage);

    function renderTable() {
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const currentRows = allRows.slice(start, end);

        const tableHTML = `
                    <div class="pagination-info">
                        Showing ${start + 1}-${Math.min(
            end,
            allRows.length
        )} of ${allRows.length} matches
                    </div>
                    <table class="locator-table">
                        <thead>
                            <tr>
                                <th width="5%">#</th>
                                <th width="10%">ID</th>
                                <th width="10%">Name</th>
                                <th width="25%">Full XPath</th>
                                <th width="25%">XPath</th>
                                <th width="25%">CSS Path</th>
                                <th width="10%">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentRows
                .map(
                    (row) => `
                               <tr onclick="focusHighlight(${row.highlightId})" style="cursor: pointer;">

                                    <td>${row.id}</td>
                                    <td>${row.elementId}</td>
                                    <td>${row.elementName}</td>
                                    <td><code>${row.fullXpath}</code></td>
                                    <td><code>${row.xpath}</code></td>
                                    <td><code>${row.cssPath}</code></td>
                                    <td>${row.type}</td>
                                </tr>
                            `
                )
                .join("")}
                        </tbody>
                    </table>
                    <div class="pagination-container">
                        <div class="pagination-buttons">
                            ${currentPage > 1
                ? `<button class="page-btn" onclick="changePage(${currentPage - 1
                })">Previous</button>`
                : `<button class="page-btn disabled" disabled>Previous</button>`
            }
                            
                            ${Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => {
                    const page =
                        Math.max(
                            1,
                            Math.min(totalPages - 4, currentPage - 2)
                        ) + i;
                    return `<button class="page-btn ${page === currentPage ? "active" : ""
                        }" 
                                        onclick="changePage(${page})">${page}</button>`;
                }
            ).join("")}
                            
                            ${currentPage < totalPages
                ? `<button class="page-btn" onclick="changePage(${currentPage + 1
                })">Next</button>`
                : `<button class="page-btn disabled" disabled>Next</button>`
            }
                        </div>
                    </div>
                `;

        container.innerHTML = tableHTML;
    }

    window.changePage = function (page) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        renderTable();
        // Scroll to top of table
        container.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    renderTable();
}
function focusHighlight(highlightId) {
    const iframe = document.getElementById("previewFrame");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    const mark = iframeDoc.querySelector(
        `mark[data-highlight-id="${highlightId}"]`
    );
    if (mark) {
        // Remove previous highlights
        iframeDoc.querySelectorAll("mark").forEach((el) => {
            el.style.outline = "";
            el.style.backgroundColor = "#ffeb3b"; // reset original
        });

        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        mark.style.outline = "3px solid red";
        mark.style.backgroundColor = "#b2fab4";
    }
}
function getElementTypeName(tagName) {
    const map = {
        button: "Button",
        input: "Input Field",
        select: "Dropdown",
        textarea: "Text Area",
        a: "Link",
        img: "Image",
        label: "Label",
        table: "Table",
        tr: "Row",
        td: "Column",
        th: "Column Header",
        div: "Section",
        span: "Text Span",
        ul: "List",
        li: "List Item",
        option: "Option",
    };

    tagName = tagName.toLowerCase();
    return map[tagName] || `Text <${tagName}>`;
}

function showStatus(message, type) {
    const statusMessage = document.getElementById("statusMessage");
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = "block";
}

// Make helper functions global for the table generation
function getXPath(el) {
    if (!el || el.nodeType !== 1) return "";

    if (el.id) {
        return `//*[@id="${el.id}"]`;
    }

    const parts = [];

    while (el && el.nodeType === 1) {
        let index = 1;
        let sibling = el.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === el.tagName) index++;
            sibling = sibling.previousElementSibling;
        }

        const tagName = el.tagName.toLowerCase();
        const segment = `${tagName}[${index}]`;
        parts.unshift(segment);

        el = el.parentNode;

        // If we hit an element with an ID, break early and prepend it
        if (el && el.nodeType === 1 && el.id) {
            parts.unshift(`*[@id="${el.id}"]`);
            break;
        }
    }

    return `//${parts.join("/")}`;
}

function getFullXPath(el) {
    if (!el || el.nodeType !== 1) return "";
    const segments = [];
    while (el && el.nodeType === 1) {
        let index = 1;
        let sibling = el.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === el.tagName) index++;
            sibling = sibling.previousElementSibling;
        }
        segments.unshift(`${el.tagName.toLowerCase()}[${index}]`);
        el = el.parentNode;
    }
    return `/${segments.join("/")}`;
}

function getCssPath(el) {
    if (!el) return "";
    const path = [];
    while (el && el.nodeType === 1) {
        let selector = el.tagName.toLowerCase();
        if (el.id) {
            selector += `#${el.id}`;
            path.unshift(selector);
            break;
        } else {
            let sib = el,
                nth = 1;
            while ((sib = sib.previousElementSibling)) {
                if (sib.tagName === el.tagName) nth++;
            }
            selector += nth > 1 ? `:nth-of-type(${nth})` : "";
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(" > ");
}
