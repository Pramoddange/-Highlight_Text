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
        const cleanUrl = url.split('#')[0];

        // Use a proxy to avoid CORS issues (you'll need to implement this server-side)
        const proxyUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(cleanUrl)}`;
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
                if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;

                const originalText = node.nodeValue;
                const matches = [...originalText.matchAll(regex)];
                if (matches.length === 0) return;


                matchCount += matches.length;
                const fragments = [];
                let lastIndex = 0;

                for (const match of matches) {
                    const { index } = match;
                    if (index > lastIndex) {
                        fragments.push(document.createTextNode(originalText.slice(lastIndex, index)));
                    }

                    const mark = document.createElement("mark");
                    mark.textContent = match[0];
                    mark.setAttribute('data-highlight-id', matchCount);
                    fragments.push(mark);
                    lastIndex = index + match[0].length;
                }

                if (lastIndex < originalText.length) {
                    fragments.push(document.createTextNode(originalText.slice(lastIndex)));
                }

                const fragmentWrapper = document.createDocumentFragment();
                fragments.forEach(fragment => fragmentWrapper.appendChild(fragment));
                parent.replaceChild(fragmentWrapper, node);
            }
            else if (node.nodeType === Node.ELEMENT_NODE) {
                Array.from(node.childNodes).forEach(child => walkAndHighlight(child));
            }
        }

        walkAndHighlight(doc.body);

        // Generate the locators table with pagination
        //generateLocatorsTable(doc, matchCount);

        // Display the highlighted content in iframe
        iframe.srcdoc = doc.documentElement.outerHTML;
        if (matchCount === 0) {
            showStatus(`No occurrences of "${word}" found.`, "error");
            return;
        }
        iframe.onload = function () {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const marks = iframeDoc.querySelectorAll('mark');

            marks.forEach(mark => {
                mark.addEventListener('click', () => {
                     highlightMark(mark)
                    handleHighlightClick(mark);
                });
            });
        };

        showStatus(`Successfully highlighted ${matchCount} occurrences of "${word}".`, "success");

    } catch (error) {
        console.error("Error:", error);
        showStatus(`Error: ${error.message}`, "error");
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const textInput = document.getElementById("textInput");
    const searchButton = document.getElementById("searchButton"); 

    // Trigger on 3+ character input
    textInput.addEventListener("input", debounce(() => {
        const word = textInput.value.trim();
        if (word.length >= 3) {
            highlightText();
        }
    }, 150));
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

function highlightMark(mark) {
    const iframe = document.getElementById("previewFrame");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    iframeDoc.querySelectorAll('mark').forEach(m => {
        m.style.outline = '';
        m.style.backgroundColor = '#ffeb3b';
    });

    mark.style.outline = '3px solid red';
    mark.style.backgroundColor = '#b2fab4';
}


/*function focusHighlight(highlightId) {
    const iframe = document.getElementById("previewFrame");
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    const mark = iframeDoc.querySelector(`mark[data-highlight-id="${highlightId}"]`);
    if (mark) {
        // Remove previous highlights
        iframeDoc.querySelectorAll('mark').forEach(el => {
            el.style.outline = '';
            el.style.backgroundColor = '#ffeb3b'; // reset original
        });

        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mark.style.outline = '3px solid red';
        mark.style.backgroundColor = '#b2fab4';
    }
}*/
function getElementTypeName(tagName) {
    const map = {
        'button': 'Button',
        'input': 'Input Field',
        'select': 'Dropdown',
        'textarea': 'Text Area',
        'a': 'Link',
        'img': 'Image',
        'label': 'Label',
        'table': 'Table',
        'tr': 'Row',
        'td': 'Column',
        'th': 'Column Header',
        'div': 'Section',
        'span': 'Text Span',
        'ul': 'List',
        'li': 'List Item',
        'option': 'Option'
    };

    tagName = tagName.toLowerCase();
    return map[tagName] || `Text <${tagName}>`;
}
function handleHighlightClick(mark) {
    const container = document.getElementById("locatorTableContainer");
    const parent = mark.parentElement;

    if (!parent) return;

    const row = {
        elementId: parent.id || "-",
        elementName: parent.getAttribute("name") || "-",
        fullXpath: getFullXPath(parent),
        xpath: getXPath(parent),
        cssPath: getCssPath(parent),
        text: mark.textContent,
        type: getElementTypeName(parent.tagName)
    };

    const tableHTML = `
        <div class="pagination-info">
            Locator info for selected match: <strong>${row.text}</strong>
        </div>
        <table class="locator-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Full XPath</th>
                    <th>XPath</th>
                    <th>CSS Path</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${row.elementId}</td>
                    <td>${row.elementName}</td>
                    <td><code>${row.fullXpath}</code></td>
                    <td><code>${row.xpath}</code></td>
                    <td><code>${row.cssPath}</code></td>
                    <td>${row.type}</td>
                </tr>
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.tagName === el.tagName) nth++;
            }
            selector += nth > 1 ? `:nth-of-type(${nth})` : "";
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(" > ");
}
