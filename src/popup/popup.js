import { signIn, signUp, getSession, signOut, getSupabase } from '../lib/supabase.js';
import { searchGmail, getMessageSnippet } from '../lib/gmail_api.js';
import { generateContent } from '../lib/gemini_api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const authStatus = document.getElementById('auth-status');
    const settingsBtn = document.getElementById('settings-btn');
    const pollGmailBtn = document.getElementById('poll-gmail');

    // Skip auth for now, just load dashboard
    const checkAuth = async () => {
        try {
            showView('dashboard');
            authStatus.textContent = `Ready`;
            loadApplications();
        } catch (error) {
            console.error('Check failed:', error);
            authStatus.textContent = 'Connection error';
        }
    };

    const showView = (view) => {
        authView.classList.add('hidden');
        dashboardView.classList.add('hidden');
        document.getElementById('profile-view').classList.add('hidden');
        
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        if (view === 'auth') authView.classList.remove('hidden');
        if (view === 'dashboard') {
            dashboardView.classList.remove('hidden');
            document.querySelector('[data-tab="dashboard"]').classList.add('active');
            loadApplications();
        }
        if (view === 'profile') {
            document.getElementById('profile-view').classList.remove('hidden');
            document.querySelector('[data-tab="profile"]').classList.add('active');
            loadProfile();
        }
    };

    const loadProfile = async () => {
        const { rr_profile } = await chrome.storage.local.get('rr_profile');
        const profile = rr_profile || {
            firstName: "Emmanuel",
            lastName: "Vayleux",
            email: "emmanuel@example.com",
            tagline: "AI Product Manager with expertise in Agentic Workflows.",
            resumeText: ""
        };

        document.getElementById('p-first-name').value = profile.firstName || "Emmanuel";
        document.getElementById('p-last-name').value = profile.lastName || "Vayleux";
        document.getElementById('p-email').value = profile.email || "";
        document.getElementById('p-tagline').value = profile.tagline || "";
        document.getElementById('p-resume-text').value = profile.resumeText || "";
    };

    const saveProfile = async () => {
        const profile = {
            firstName: document.getElementById('p-first-name').value,
            lastName: document.getElementById('p-last-name').value,
            email: document.getElementById('p-email').value,
            tagline: document.getElementById('p-tagline').value,
            resumeText: document.getElementById('p-resume-text').value,
            updatedAt: new Date().toISOString()
        };

        await chrome.storage.local.set({ rr_profile: profile });
        
        const saveBtn = document.getElementById('save-profile');
        saveBtn.textContent = "✅ Saved!";
        saveBtn.classList.remove('primary-btn-sm');
        saveBtn.style.background = "#22c55e";
        
        setTimeout(() => {
            saveBtn.textContent = "Save Changes";
            saveBtn.style.background = "";
            saveBtn.classList.add('primary-btn-sm');
        }, 2000);
    };

    const loadApplications = async () => {
        const list = document.getElementById('application-list');
        const appliedCount = document.getElementById('applied-count');
        const interviewCount = document.getElementById('interview-count');
        
        list.innerHTML = '<li>Loading applications...</li>';
        
        try {
            const supabase = await getSupabase();
            const { data: apps, error } = await supabase.from('applications').select('*').order('date_applied', { ascending: false });

            if (error) throw error;
            if (!apps) throw new Error('No connection to Supabase');

            list.innerHTML = '';
            appliedCount.textContent = apps?.length || 0;
            interviewCount.textContent = apps?.filter(a => a.status === 'Interview Invite' || a.status === 'Interview').length || 0;

            if (apps.length === 0) {
                list.innerHTML = '<li style="justify-content:center; color:#666;">No applications tracked yet.</li>';
                return;
            }

            apps.forEach(app => {
                const li = document.createElement('li');
                const statusClass = app.status.toLowerCase().replace(/\s/g, '-');
                li.innerHTML = `
                    <div><strong>${app.job_title}</strong> @ ${app.company}</div>
                    <span class="status status-${statusClass}" style="padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700; background:#eee;">${app.status}</span>
                `;
                list.appendChild(li);
            });
        } catch (error) {
            console.error('Failed to load apps:', error);
            list.innerHTML = `
                <li style="flex-direction:column; gap:8px;">
                    <div style="color:#d93025; font-size:12px;">Failed to load. Is Supabase configured?</div>
                    <button id="retry-btn" class="secondary-btn" style="padding:4px 12px; font-size:11px;">Retry</button>
                </li>
            `;
            const retry = document.getElementById('retry-btn');
            if (retry) retry.onclick = () => {
                // Force clear cached client for retry
                window.location.reload(); 
            };
        }
    };

    // Event Listeners
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        
        authStatus.textContent = 'Signing in...';
        const { error } = await signIn(email, password);
        if (error) {
            alert(error.message);
            authStatus.textContent = 'Login failed';
        } else {
            checkAuth();
        }
    });

    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    pollGmailBtn.addEventListener('click', async () => {
        authStatus.textContent = 'Polling Gmail...';
        pollGmailBtn.disabled = true;

        try {
            const supabase = await getSupabase();
            const { data: apps } = await supabase.from('applications').select('*').eq('status', 'Ongoing');
            
            if (!apps || apps.length === 0) {
                alert('No ongoing applications to track.');
                return;
            }

            for (const app of apps) {
                const messages = await searchGmail(`${app.company} after:2024/01/01`); // Search recent
                if (messages.length > 0) {
                    const snippet = await getMessageSnippet(messages[0].id);
                    
                    const prompt = `
                        Classify the following email snippet regarding a job application at ${app.company}.
                        Status options: "Ongoing", "Interview Invite", "Rejected", "Offer".
                        Snippet: "${snippet}"
                        Return ONLY the status string.
                    `;
                    const status = await generateContent(prompt);
                    const cleanStatus = status.trim().replace(/"/g, '');

                    if (cleanStatus !== app.status) {
                        await supabase.from('applications').update({ status: cleanStatus, last_status_update: new Date() }).eq('id', app.id);
                        console.log(`Updated ${app.company} to ${cleanStatus}`);
                    }
                }
            }
            
            await loadApplications();
            authStatus.textContent = 'Sync complete';
        } catch (error) {
            console.error('Polling failed:', error);
            alert('Status sync failed. Check console.');
        } finally {
            pollGmailBtn.disabled = false;
            setTimeout(() => checkAuth(), 3000);
        }
    });

    checkAuth();

    // Listen for storage changes (API keys updated)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.supabaseUrl || changes.supabaseKey || changes.geminiApiKey)) {
            console.log('Settings changed, reloading...');
            window.location.reload();
        }
    });

    // Tab Events
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => showView(btn.getAttribute('data-tab'));
    });

    // Profile Events
    const saveBtn = document.getElementById('save-profile');
    if (saveBtn) saveBtn.onclick = saveProfile;
});
