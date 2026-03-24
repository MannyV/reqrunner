// LinkedIn UI Injection & Referral Engine

(function() {
    let currentJobId = null;

    // Monitor URL changes for LinkedIn (SPA)
    const observer = new MutationObserver(() => {
        checkAndInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Periodic check as fallback
    setInterval(() => {
        checkAndInject();
    }, 2000);

    function checkAndInject() {
        if (window.location.hostname.includes('linkedin.com')) {
            const jobId = getJobIdFromUrl();
            if (jobId) {
                injectAutoApplyButton();
            }
        } else {
            runExternalSiteLogic();
        }
    }

    function getJobIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('currentJobId') || 
               (window.location.pathname.match(/\/view\/(\d+)/)?.[1]) ||
               (window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1]);
    }

    function injectAutoApplyButton() {
        // Target specific LinkedIn containers to ensure single injection per group
        const anchors = document.querySelectorAll('.jobs-save-button, .jobs-apply-button--top-card, .jobs-s-apply button');
        
        anchors.forEach(anchor => {
            // Traverse up to the primary 'Actions' container or flex row
            const group = anchor.closest('.jobs-unified-top-card__content--actions') || 
                          anchor.closest('.jobs-details-sticky-header__actions') ||
                          anchor.closest('.display-flex') || 
                          anchor.parentElement;

            if (group) {
                // Check if our button already exists ANYWHERE in this action group (including nested children)
                if (!group.querySelector('.rr-auto-apply-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'rr-auto-apply-btn';
                    btn.style.margin = '0 8px'; // Add some spacing
                    btn.innerHTML = '✨ Auto-Apply <span style="font-size:10px;">↗</span>';
                    
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Req Runner: Auto-Apply clicked!');
                        await handleAutoApplyClick(e);
                    }, true);
                    
                    anchor.parentElement.appendChild(btn);
                    console.log('Req Runner: Button successfully bound.');
                }
            }
        });
    }

    async function handleAutoApplyClick(event) {
        const btn = event.currentTarget;
        btn.innerHTML = '⏳ Processing...';
        btn.disabled = true;

        try {
            // 1. Scrape Job Details
            const jobTitle = document.querySelector('.jobs-unified-top-card__job-title')?.innerText.trim() || 
                             document.querySelector('.jobs-details-sticky-header__title')?.innerText.trim();
            const company = document.querySelector('.jobs-unified-top-card__company-name')?.innerText.trim() ||
                            document.querySelector('.jobs-details-sticky-header__subtitle')?.innerText.trim();
            
            // 2. Scrape Connections
            const connections = scrapeConnections();

            // 3. Check for referrals
            if (connections.length > 0) {
                showReferralModal(connections, jobTitle, company);
            } else {
                startAutoFillSequence(jobTitle, company);
            }
        } catch (e) {
            console.error('Auto-Apply failed:', e);
            alert('Something went wrong during auto-apply logic.');
        } finally {
            btn.innerHTML = '✨ Auto-Apply <span style="margin-left:4px; font-size:12px;">↗</span>';
            btn.disabled = false;
        }
    }

    function scrapeConnections() {
        const connectionNodes = document.querySelectorAll('.jobs-upsell__people-list-item, .jobs-poster-card__name');
        return Array.from(connectionNodes).map(node => node.innerText.trim()).filter(Boolean);
    }

    function showReferralModal(connections, jobTitle, company) {
        // Create modal for referral check
        const overlay = document.createElement('div');
        overlay.className = 'rr-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'rr-modal';
        modal.innerHTML = `
            <div class="rr-modal-header">
                <h2>Referral Check Found</h2>
                <button class="rr-modal-close" onclick="this.closest('.rr-overlay').remove()">×</button>
            </div>
            <div class="rr-modal-content">
                <p>We found ${connections.length} connections at ${company}. Would you like to generate a referral message first?</p>
                <div id="rr-referral-output" style="background:#f9f9f9; padding:10px; border-radius:4px; margin: 10px 0; min-height: 50px; font-family: monospace; white-space: pre-wrap;">
                    Generating best outreach message...
                </div>
            </div>
            <div class="rr-modal-actions" style="display:flex; gap:10px;">
                <button id="rr-copy-referral" class="rr-copy-btn">Copy & Proceed</button>
                <button id="rr-skip-referral" class="secondary-btn" style="border:1px solid #666; padding:8px 16px; border-radius:4px; cursor:pointer;">Skip Referral</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Fetch outreach from Gemini (via background script for secure storage access)
        chrome.runtime.sendMessage({
            action: 'generateReferral',
            data: { connections, jobTitle, company }
        }, (response) => {
            const output = document.getElementById('rr-referral-output');
            if (response?.error) {
                output.innerText = "Error: " + response.error;
            } else {
                output.innerText = response.message;
            }
        });

        document.getElementById('rr-copy-referral').onclick = () => {
            const text = document.getElementById('rr-referral-output').innerText;
            navigator.clipboard.writeText(text);
            overlay.remove();
            startAutoFillSequence(jobTitle, company);
        };

        document.getElementById('rr-skip-referral').onclick = () => {
            overlay.remove();
            startAutoFillSequence(jobTitle, company);
        };
    }

    async function startAutoFillSequence(jobTitle, company) {
        console.log(`Req Runner: Activating pathway for ${jobTitle} at ${company}...`);
        
        // Ensure flag is set BEFORE any navigation happens
        await chrome.storage.local.set({ 
            rr_pathway_active: true,
            rr_job_context: { jobTitle, company, timestamp: Date.now() }
        });

        const lateralApplyBtn = document.querySelector('.jobs-apply-button--top-card button, .jobs-s-apply button');
        if (lateralApplyBtn) {
            console.log('Req Runner: Triggering native apply action.');
            lateralApplyBtn.click();
            // In case it opens a modal instead of a new tab
            setTimeout(() => autoFillForm(), 1500);
        } else {
            console.log('Req Runner: No native apply button found, assuming external redirect.');
        }
    }

    async function autoFillForm() {
        // Find form containers (LinkedIn or general)
        const form = document.querySelector('form') || document.body;
        const schema = scrapeFormFields(form);
        console.log('Scraped Schema:', schema);

        // Notify user about incoming AI processing
        showProcessingStatus("AI mapping your data...");

        // Get user data from storage/supabase (via background)
        chrome.runtime.sendMessage({
            action: 'getMapping',
            data: { schema, jobTitle: document.title }
        }, (response) => {
            if (response?.error) {
                console.error("Mapping failed:", response.error);
                hideProcessingStatus();
                return;
            }

            const { mapping, unknownFields } = response;
            
            // Populate fields
            populateFields(mapping);

            // Handle unknown fields (Human-in-the-loop)
            if (unknownFields && unknownFields.length > 0) {
                handleUnknownFields(unknownFields);
            } else {
                showProcessingStatus("AI ready! Check and submit.", 3000);
            }
        });
    }

    function scrapeFormFields(container) {
        const fields = [];
        
        const scan = (root) => {
            const inputs = root.querySelectorAll('input:not([type="hidden"]), textarea, select');
            inputs.forEach(input => {
                const label = findLabel(input);
                const type = input.tagName.toLowerCase() === 'input' ? input.type : input.tagName.toLowerCase();
                
                fields.push({
                    id: input.id || input.name,
                    name: input.name,
                    label: label?.innerText.trim() || input.placeholder || input.getAttribute('aria-label') || "Unknown Field",
                    type: type,
                    required: input.required || input.getAttribute('aria-required') === 'true'
                });
            });

            // Pierce Shadow DOM
            const allElements = root.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.shadowRoot) scan(el.shadowRoot);
            });
        };

        scan(container);
        return fields;
    }

    function findLabel(input) {
        if (input.id) {
            const labelFor = document.querySelector(`label[for="${input.id}"]`);
            if (labelFor) return labelFor;
        }
        // Try parent tree for label
        let parent = input.parentElement;
        while (parent) {
            const label = parent.querySelector('label');
            if (label) return label;
            if (parent.tagName === 'FORM') break;
            parent = parent.parentElement;
        }
        return null;
    }

    function populateFields(mapping) {
        const findField = (root, key) => {
            let found = root.getElementById(key) || root.querySelector(`[name="${key}"]`);
            if (found) return found;

            const all = root.querySelectorAll('*');
            for (const el of all) {
                if (el.shadowRoot) {
                    found = findField(el.shadowRoot, key);
                    if (found) return found;
                }
            }
            return null;
        };

        for (const [key, value] of Object.entries(mapping)) {
            const input = findField(document, key);
            if (input && value !== null) {
                input.value = value;
                // Trigger events to notify page scripts (React/Vue/Angular)
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`Req Runner: Populated ${key} with ${value}`);
            }
        }
    }

    function handleUnknownFields(unknownFields) {
        hideProcessingStatus();
        const field = unknownFields[0]; // Process one-by-one or in batch
        showHumanPrompt(field);
    }

    function showHumanPrompt(field) {
        const overlay = document.createElement('div');
        overlay.className = 'rr-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'rr-modal';
        modal.innerHTML = `
            <div class="rr-modal-header">
                <h2>AI Question</h2>
                <button class="rr-modal-close">×</button>
            </div>
            <div class="rr-modal-content">
                <p>Gemini doesn't know the answer to this question. Please provide it, and we'll save it to your memory bank for next time:</p>
                <div style="font-weight: 600; margin-bottom: 10px;">${field.label}</div>
                <textarea id="rr-human-answer" style="width: 100%; height: 100px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;"></textarea>
            </div>
            <div class="rr-modal-actions">
                <button id="rr-submit-answer" class="rr-copy-btn">Save & Resume</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('rr-submit-answer').onclick = () => {
            const answer = document.getElementById('rr-human-answer').value;
            if (!answer) return;

            // Save to Supabase (via background)
            chrome.runtime.sendMessage({
                action: 'saveToMemoryBank',
                data: { question: field.label, answer: answer }
            }, () => {
                // Also fill the actual form field
                populateFields({ [field.id]: answer });
                overlay.remove();
                // Check if more unknown fields exist (recursion or loop)
            });
        };
        modal.querySelector('.rr-modal-close').onclick = () => overlay.remove();
    }

    // --- External Portal Pathfinder (Greenhouse, Lever, Workday) ---
    async function runExternalSiteLogic() {
        const host = window.location.hostname;
        const currentUrl = window.location.href;
        
        // Skip LinkedIn logic on external sites
        if (host.includes('linkedin.com')) return;

        // --- PATHWAY HANDSHAKE CHECK ---
        const { rr_pathway_active } = await chrome.storage.local.get('rr_pathway_active');
        if (!rr_pathway_active) {
            console.log('Req Runner: Automation standby (Pathway not active).');
            return;
        }

        // --- ANTI-LOOP CHECK ---
        if (sessionStorage.getItem('rr_pathfound_' + currentUrl)) {
            console.log('Req Runner: Pathfinder already completed for this URL.');
            return;
        }

        // Check if a form is already present (Form mode takes priority)
        const visibleInputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
        if (visibleInputs.length > 2) {
            console.log('Req Runner: Form detected! Starting pre-fill...');
            showProcessingStatus("✨ AI Form Detection active!");
            
            // Mark as completed to avoid re-triggering autoFillForm on every interval
            sessionStorage.setItem('rr_pathfound_' + currentUrl, 'true');
            
            autoFillForm();
            
            // Clear pathway once we successfully start the form
            chrome.storage.local.remove('rr_pathway_active');
            return;
        }

        // HEURISTIC: Find the 'Next' or 'Apply' button
        const searchTerms = ['apply', 'get started', 'begin', 'next', 'apply now', 'register', 'apply to', 'apply for this job', 'start application'];
        const allElements = Array.from(document.querySelectorAll('button, a, div[role="button"], span.btn, .button, .job-apply, [role="link"]'));
        
        const nextButton = allElements.find(el => {
            const text = el.innerText.trim().toLowerCase();
            const isVisible = el.offsetParent !== null || el.getClientRects().length > 0;
            return isVisible && searchTerms.some(term => text === term || text.includes(term));
        });

        if (nextButton) {
            console.log('Req Runner: Pathfinder identified current step:', nextButton.innerText);
            
            // Mark as clicked in sessionStorage to prevent loop
            sessionStorage.setItem('rr_pathfound_' + currentUrl, 'true');

            // Highlight with extreme priority indigo glow
            nextButton.style.setProperty('box-shadow', '0 0 20px #6366f1, 0 0 40px rgba(99, 102, 241, 0.6)', 'important');
            nextButton.style.setProperty('outline', '3px solid #6366f1', 'important');
            
            showProcessingStatus(`🧭 Pathfinder: Moving to "${nextButton.innerText.trim()}"...`);

            // Auto-click rapidly (High Velocity: 300ms)
            setTimeout(() => {
                nextButton.click();
            }, 300);
        }
    }

    // Initialize on load for external sites
    if (!window.location.hostname.includes('linkedin.com')) {
        runExternalSiteLogic();
    }

    function showProcessingStatus(text, duration = 0) {
        let status = document.getElementById('rr-processing-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'rr-processing-status';
            // Premium Indigo/Violet Gradient with Blur
            status.style.cssText = `
                position: fixed !important; 
                bottom: 24px !important; 
                right: 24px !important; 
                left: auto !important;
                background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
                color: #fff !important; 
                padding: 10px 18px !important; 
                border-radius: 40px !important; 
                z-index: 2147483647 !important; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto !important;
                font-size: 13px !important;
                font-weight: 600 !important; 
                opacity: 0 !important; 
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important; 
                box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4) !important; 
                display: flex !important; 
                align-items: center !important; 
                gap: 8px !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                transform: translateY(10px) !important;
            `;
            document.body.appendChild(status);
        }
        
        // Dynamic content with Sparkle Icon
        status.innerHTML = `
            <span style="font-size: 16px;">✨</span>
            <span style="letter-spacing: 0.2px;">${text}</span>
        `;
        
        status.style.opacity = '1';
        status.style.transform = 'translateY(0)';
        
        // Only hide if a duration is specified
        if (duration > 0) {
            setTimeout(() => {
                status.style.opacity = '0';
                status.style.transform = 'translateY(10px)';
                setTimeout(() => status.remove(), 400);
            }, duration);
        }
    }

    function hideProcessingStatus() {
        const status = document.getElementById('rr-processing-status');
        if (status) {
            status.style.opacity = '0';
            setTimeout(() => status.remove(), 300);
        }
    }
})();
