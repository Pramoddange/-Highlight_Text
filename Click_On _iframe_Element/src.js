let selectedLocators = [];

document.getElementById('loadBtn').addEventListener('click', async () => {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) return;

    // Fetch page via proxy to avoid CORS
    const proxyUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();

    const iframe = document.getElementById('previewFrame');
    iframe.srcdoc = html;

    iframe.onload = function () {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        // Add click listener to all elements in the iframe
        iframeDoc.body.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            highlightAndStore(e.target, iframeDoc);
        }, true);
        // Double-click to remove highlight and locator
        iframeDoc.body.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            removeHighlightAndLocator(e.target, iframeDoc);
        }, true);
    };
});

function highlightAndStore(element, doc) {
    if (element.hasAttribute('data-locator-id')) return; // Already highlighted

    // Highlight
    element.style.outline = '3px solid red';
    element.style.backgroundColor = '#b2fab4';

    // Generate locator info
    const locator = {
        id: Date.now() + Math.random(),
        elementId: element.id || "-",
        elementName: element.getAttribute("name") || "-",
        fullXpath: getFullXPath(element),
        xpath: getXPath(element),
        cssPath: getCssPath(element),
        tag: element.tagName
    };
    element.setAttribute('data-locator-id', locator.id);

    selectedLocators.push(locator);
    renderLocatorsTable();
}

function removeHighlightAndLocator(element, doc) {
    const locatorId = element.getAttribute('data-locator-id');
    if (!locatorId) return;

    // Remove highlight
    element.style.outline = '';
    element.style.backgroundColor = '';
    element.removeAttribute('data-locator-id');

    // Remove from table
    selectedLocators = selectedLocators.filter(l => l.id != locatorId);
    renderLocatorsTable();
}

function renderLocatorsTable() {
    const container = document.getElementById("locatorTableContainer");
    if (selectedLocators.length === 0) {
        container.innerHTML = "<div>No locators selected.</div>";
        return;
    }

    const rows = selectedLocators.map(row => `
        <tr>
            <td>${row.elementId}</td>
            <td>${row.elementName}</td>
            <td><code>${row.fullXpath}</code></td>
            <td><code>${row.xpath}</code></td>
            <td><code>${row.cssPath}</code></td>
            <td>${row.tag}</td>
        </tr>
    `).join("");

    container.innerHTML = `
        <table class="locator-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Full XPath</th>
                    <th>XPath</th>
                    <th>CSS Path</th>
                    <th>Tag</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

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
        parts.unshift(`${el.tagName.toLowerCase()}[${index}]`);
        el = el.parentNode;
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