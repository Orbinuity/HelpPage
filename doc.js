const loadMarked = (() => {
    let promise = null;
    return () => {
        if (typeof marked !== 'undefined') {
            return Promise.resolve();
        }
        if (!promise) {
            promise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load marked library script.'));
                document.head.appendChild(script);
            });
        }
        return promise;
    };
})();

async function parseDoc(markdownText) {
    await loadMarked();

    const tokens = marked.lexer(markdownText);
    
    const root = { level: 0, children: {} };
    const stack = [root];

    function formatContentToken(token) {
        switch (token.type) {
            case 'paragraph':
                return { type: 'plain', value: token.text };
            case 'code':
                return { type: 'code', value: token.text, language: token.lang || 'text' };
            case 'list':
                return { type: 'list', value: token.items.map(item => item.text) };
            case 'blockquote':
                return { type: 'quote', value: token.text };
            default:
                return { type: token.type, value: token.raw.trim() };
        }
    }

    for (const token of tokens) {
        if (token.type === 'heading') {
            const newNode = {
                level: token.depth,
                content: [],
                children: {}
            };

            while (stack[stack.length - 1].level >= token.depth) {
                stack.pop();
            }

            const parent = stack[stack.length - 1];
            parent.children[token.text] = newNode;
            
            stack.push(newNode);
        } else if (token.type !== 'space') {
            const current = stack[stack.length - 1];
            if (current !== root) {
                current.content.push(formatContentToken(token));
            }
        }
    }

    return root.children;
}

async function parseHTML(content) {
    await loadMarked();
    
    if (content.type === "plain") {
        let cardDesc = document.createElement("p");
        cardDesc.textContent = content.value;
        return cardDesc.outerHTML;
    } else if (content.type === "code") {
        if (content.language === "markdown") {
            return marked.parse(content.value);
        } else {
            //window.location.href = "/";
            console.error("Unsuported doc language: "+content.language);
        }
    } else {
        //window.location.href = "/";
        console.error("Unseported content type: "+content.type);
    }
}

function generateNav(children, project) {
    const div = document.createElement("nav-group");
    div.className = "nav-group";
    const ul = document.createElement("ul");
    for (const child of Object.keys(children)) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `?project=${encodeURIComponent(project)}&h=${encodeURIComponent(child)}`;
        a.innerText = child;
        li.innerHTML = a.outerHTML;
        ul.innerHTML += li.outerHTML;
        for (const subChild of Object.keys(children[child].children)) {
            const li = document.createElement("li");
            li.className = "sub-link";
            const a = document.createElement("a");
            a.href = `?project=${encodeURIComponent(project)}&h=${encodeURIComponent(child)}&s=${encodeURIComponent(subChild)}`;
            a.innerText = subChild;
            li.innerHTML = a.outerHTML;
            ul.innerHTML += li.outerHTML;
        }
    }
    div.innerHTML = ul.outerHTML;
    return div;
}

function attachCopyButtons(container) {
    const preBlocks = container.querySelectorAll('pre');

    preBlocks.forEach((pre) => {
        if (pre.querySelector('.copy-btn')) return;

        pre.style.position = 'relative';

        const button = document.createElement('button');
        button.className = 'copy-btn';
        button.textContent = 'Copy';

        Object.assign(button.style, {
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: 'auto',
            maxWidth: 'none',
            display: 'inline-block',
            padding: '4px 10px',
            fontSize: '12px',
            margin: '0',
            boxShadow: 'none',
            zIndex: '10'
        });

        button.addEventListener('click', async () => {
            const codeText = pre.querySelector('code')?.innerText || pre.innerText;
            try {
                await navigator.clipboard.writeText(codeText.trim());
                button.textContent = 'Copied!';
                setTimeout(() => { button.textContent = 'Copy'; }, 2000);
            } catch (err) {
                console.error('Failed to copy code block text:', err);
            }
        });

        pre.appendChild(button);
    });
}

async function renderContent() {
    const urlParams = new URLSearchParams(window.location.search);
    const project = urlParams.get('project');
    const header = urlParams.get('h');
    const sub = urlParams.get('s');

    if (!project || project === '/') {
        //window.location.href = "/";
        return;
    }

    const title = document.getElementById('doc-title');
    const name = document.getElementById('doc-name');
    const card = document.getElementById("doc-card");
    const nav = document.getElementById("doc-nav");

    try {
        const response = await fetch(`/nogo/docs/${project}.md`);
        const mdText = await response.text();
        const doc = await parseDoc(mdText);

        const firstKey = Object.keys(doc)[0];
        const firstDoc = Object.values(doc)[0];

        const a = document.createElement("a");
        a.href = `?project=${encodeURIComponent(project)}`;
        a.style = "color: white;"
        const h2 = document.createElement("h2");
        h2.textContent = firstKey
        a.innerHTML = h2.outerHTML
        nav.innerHTML = a.outerHTML;
        nav.innerHTML += generateNav(firstDoc.children, project).outerHTML;

        let targetContent;
        if (header) {
            if (sub) {
                title.textContent = `${firstKey} | ${sub}`;
                name.textContent = sub;
                targetContent = firstDoc.children[header].children[sub].content[0];
            } else {
                title.textContent = `${firstKey} | ${header}`;
                name.textContent = header;
                targetContent = firstDoc.children[header].content[0];
            }
        } else {
            title.textContent = firstKey;
            name.textContent = firstKey;
            targetContent = firstDoc.content[0];
        }

        card.innerHTML = await parseHTML(targetContent);

        hljs.highlightAll();
        attachCopyButtons(card);
    } catch (err) {
        //window.location.href = "/";
        console.error("Failed to load documentation:", err);
    }
}

renderContent();

window.addEventListener('popstate', renderContent);