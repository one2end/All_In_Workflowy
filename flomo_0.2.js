
// 创建一个函数来加载脚本
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script); 
    });
}

// 加载所需的脚本
Promise.all([
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js'),
    loadScript('https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js')
]).then(() => {
    // 所有脚本加载完成后，执行主要逻辑
    main();
}).catch(error => {
    console.error('Error loading scripts:', error);
});

function main() {
    const FLOMO_BASE_URL = "https://flomoapp.com/api/v1/memo/updated/";
    const FLOMO_ACCESS_TOKEN = "Bearer 8313XXXXXXXM";

    function deleteAllItemsIfFlomo() {
        if (WF.currentItem().getName() === "Flomo") {
            const children = WF.currentItem().getChildren();
            children.forEach(item => {
                WF.deleteItem(item);
            });
        }
    }

    // 调用新增的函数
    deleteAllItemsIfFlomo();

    /**
     * 获取请求参数并生成签名
     * 
     * @param {Object} params 请求参数
     * @return {Object} 处理后的请求参数
     */
    function getParams(params = {}) {
        const currentTimestamp = Math.floor(Date.now() / 1000).toString();
        const defaultParams = {
            limit: 500,
            tz: "8:0",
            timestamp: currentTimestamp,
            api_key: "flomo_web",
            app_version: "2.0"
        };

        if (params.latest_slug && params.latest_updated_at) {
            defaultParams.latest_slug = params.latest_slug;
            defaultParams.latest_updated_at = params.latest_updated_at;
        }

        const paramStr = Object.keys(defaultParams)
            .sort()
            .map(key => `${key}=${defaultParams[key]}`)
            .join('&');
        const salt = "dbbc3dd73364b4084c3a69346e0ce2b2";
        defaultParams.sign = CryptoJS.MD5(paramStr + salt).toString();

        return defaultParams;
    }

    /**
     * 从 Flomo 获取更新的条目
     * 
     * @param {Object} params 请求参数
     * @return {Promise} 返回包含更新条目的 Promise 对象
     */
    async function getFlomoUpdates(params) {
        const url = new URL(FLOMO_BASE_URL);
        const queryParams = getParams(params);
        Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': FLOMO_ACCESS_TOKEN,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    /**
     * 获取所有 Flomo 的条目
     * 
     * @param {Object} params 请求参数
     * @return {Promise} 返回包含所有条目的 Promise 对象
     */
    async function getAllFlomoMemos(params = {}) {
        let allMemos = [];
        let hasMore = true;

        while (hasMore) {
            const flomoData = await getFlomoUpdates(params);
            const memos = flomoData.data;

            if (memos.length > 0) {
                allMemos = allMemos.concat(memos);
                if (memos.length >= 500) {
                    const lastMemo = memos[memos.length - 1];
                    params.latest_slug = lastMemo.slug;
                    params.latest_updated_at = Math.floor(new Date(lastMemo.updated_at).getTime() / 1000);
                } else {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        return allMemos;
    }



    /**
     * 将 Flomo 的条目添加到 Workflowy
     */
    async function addAllFlomoEntriesToWorkflowy() {
    try {
        const allMemos = await getAllFlomoMemos();
        console.log("allMemos:", allMemos);
    
        if (!allMemos || !Array.isArray(allMemos)) {
            throw new Error("Failed to fetch entries from Flomo.");
        }

        const stats = {
            totalMemos: allMemos.length,
            newMemos: 0,
            deletedMemos: 0,
            updatedMemos: 0
        };

        // 批量创建 Workflowy 条目
        const batchSize = 50; // 可以根据实际情况调整
        for (let i = 0; i < allMemos.length; i += batchSize) {
            const batch = allMemos.slice(i, i + batchSize);
            await Promise.all(batch.map(async (memo) => {
                await createWorkflowyEntry(memo);


            }));

            // 添加小延迟
            await new Promise(resolve => setTimeout(resolve, 100));
        }


        console.log("Import complete!");
        WF.showAlertDialog(`<strong>Success!</strong><br /><br />
            <strong>Imported:</strong><br />
            - ${stats.newMemos} new library items<br />`);
            // <strong>Updated:</strong><br />
            //- ${stats.updatedMemos} existing library items<br />
            //<strong>Deleted:</strong><br />
            //- ${stats.deletedMemos} items
    } catch (error) {
        console.error("Error fetching or processing Flomo entries:", error);
    }
}
async function createWorkflowyEntry(memo) {
    const { content, slug, created_at, updated_at } = memo;

    // 实现重试机制
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const wfEntry = WF.createItem(WF.currentItem(), 0);

            // 添加链接和日期信息作为节点内容
            const link = `https://v.flomoapp.com/mine/?memo_id=${slug}`;
            const itemNotes = [
                `<a href="${link}">Link</a>`,
                `Created At: ${new Date(created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')}`,
                `Updated At: ${new Date(updated_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')}`,
                `Slug: ${slug}`
            ];
            WF.setItemName(wfEntry, itemNotes.join(" | "));

            // 将 <p> 标签内容进行分段
            const paragraphs = content.split('</p>').map(p => p.replace('<p>', '').trim()).filter(p => p);
            const formattedContent = paragraphs.join('\n\n');

            // 将整个 content 作为 _note 写入
            WF.setItemNote(wfEntry, formattedContent);

            return wfEntry;
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        }
    }
}
    // 调用函数以同步 Flomo 内容到 Workflowy
    addAllFlomoEntriesToWorkflowy();
}
