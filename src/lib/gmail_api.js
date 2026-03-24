// Gmail API Helper
export async function getGmailToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(token);
            }
        });
    });
}

export async function searchGmail(query) {
    const token = await getGmailToken();
    const endpoint = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(endpoint, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) throw new Error('Gmail API Error');
    const data = await response.json();
    return data.messages || [];
}

export async function getMessageSnippet(messageId) {
    const token = await getGmailToken();
    const endpoint = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=minimal`;
    
    const response = await fetch(endpoint, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) throw new Error('Gmail API Error');
    const data = await response.json();
    return data.snippet;
}
