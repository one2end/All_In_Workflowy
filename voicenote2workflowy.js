let newNoteCount = 0; // 初始化 newNoteCount
let existingNoteCount = 0; // 初始化 existingNoteCount
let updatedNoteCount = 0; // 初始化 updatedNoteCount

async function fetchVoiceNotes() {
    const response = await fetch('https://api.voicenotes.com/api/recordings/all', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer 8061XXXXXXX',  // your beaer api
            'Accept': 'application/json',
  
        }
    });

    if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
    }

    const data = await response.json();
    return data;
}

function formatDate(dateString) {
    // 解析日期字符串
    const date = new Date(dateString);

    // 获取年、月、日、小时、分钟和秒
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // 格式化日期字符串
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 示例调用console.log(formatDate("2024-06-30T03:39:24.000000Z")); // 输出: 2024-06-30 03:39:24

function findItemByRecordingId(recordingId) {
    const items = WF.currentItem().getChildren();
    for (let item of items) {
        const note = item.getNote();
        if (note && note.includes(`Recording ID: ${recordingId}`)) {
            return item;
        }
    }
    return null;
}

function isContentChanged(existingItem, newNote) {
    const existingNote = existingItem.getNote();
    const newNoteContent = [
    "Created At: " + formatDate(newNote.created_at),
"Updated At: " + formatDate(newNote.updated_at),
"Recording ID: " + newNote.recording_id
    ].join(" | ");
    return existingNote !== newNoteContent || existingItem.getChildren().some(child => child.getName() === "Transcript" && child.getNote() !== newNote.transcript);
}

async function addOrUpdateVoiceNoteToWF(note) {
    let wfNote = findItemByRecordingId(note.recording_id);

    if (!wfNote) {
        wfNote = WF.createItem(WF.currentItem(), 0);
        newNoteCount++;
    } else {
        existingNoteCount++;
        if (!isContentChanged(wfNote, note)) {
            return; // 内容没有变化，不需要更新
        }
    }

   // note.updated_at = convertToEastEightZone(note.updated_at);

    WF.setItemName(wfNote, note.title);

    let itemNotes = [];
    itemNotes.push("Created At: " + formatDate(note.created_at));
    itemNotes.push("Updated At: " + formatDate(note.updated_at));
    itemNotes.push("Recording ID: " + note.recording_id);

    WF.setItemNote(wfNote, itemNotes.join(" | "));

    // 创建或更新下一级节点放置 Transcript
    let transcriptNode = wfNote.getChildren().find(child => child.getName() === "Transcript");
    if (!transcriptNode) {
        transcriptNode = WF.createItem(wfNote, 0);
        WF.setItemName(transcriptNode, "Transcript");
    }
    WF.setItemNote(transcriptNode, note.transcript);

    updatedNoteCount++;
}

async function importVoiceNotes() {
    try {
        const voiceNotes = await fetchVoiceNotes();
        const existingItems = WF.currentItem().getChildren();
        const existingIds = new Set(existingItems.map(item => {
            const note = item.getNote();
            const match = note && note.match(/Recording ID: (\d+)/);
            return match ? match[1] : null;
        }).filter(id => id !== null));

        voiceNotes.forEach(function(note) {
            if (note.deleted_at) {
                const item = findItemByRecordingId(note.recording_id);
                if (item) {
                    WF.deleteItem(item);
                }
            } else if (note.title && note.transcript) {
                addOrUpdateVoiceNoteToWF(note);
                existingIds.delete(note.recording_id.toString());
            }
        });

        // 删除不存在的笔记
        existingIds.forEach(id => {
            const item = findItemByRecordingId(id);
            if (item) {
                WF.deleteItem(item);
            }
        });

        WF.showAlertDialog(`<strong>Success!</strong><br /><br /><strong>Imported:</strong><br />- ${newNoteCount} new notes<br /><br /><strong>Updated:</strong><br />- ${updatedNoteCount} notes<br /><br /><strong>Existing:</strong><br />- ${existingNoteCount} existing notes`);

        console.log('VoiceNotes imported successfully');
    } catch (error) {
        console.error('Error importing VoiceNotes:', error);
    }
}

// 调用导入函数
importVoiceNotes();
