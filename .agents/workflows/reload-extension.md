1. Run the following command to reload the extension via AppleScript:

// turbo
```bash
osascript -e 'tell application "Google Chrome"
    set found to false
    repeat with w in windows
        set i to 1
        repeat with t in tabs of w
            set theUrl to (URL of t)
            set theTitle to (title of t)
            if theUrl contains "ahoacpcdjkpeocadmifkcnajdnfjdoai" or (theTitle contains "Extensions" and theTitle contains "Req Runner") then
                set active tab index of w to i
                set index of w to 1
                try
                    -- Try Detail View selector first
                    execute t javascript "document.querySelector(\"extensions-manager\").shadowRoot.querySelector(\"extensions-detail-view\").shadowRoot.querySelector(\"#reloadButton\").click()"
                    set found to true
                on error
                    -- Fallback to Item List selector if detail view fails
                    execute t javascript "document.querySelector(\"extensions-manager\").shadowRoot.querySelector(\"extensions-item-list\").shadowRoot.querySelector(\"extensions-item[id=\\\"ahoacpcdjkpeocadmifkcnajdnfjdoai\\\"]\").shadowRoot.querySelector(\"#dev-reload-button\").click()"
                    set found to true
                end try
                if found then return "Req Runner Reloaded! ✨"
            end if
            set i to i + 1
        end repeat
    end repeat
    return "Extension tab not found. Please keep chrome://extensions/?id=ahoacpcdjkpeocadmifkcnajdnfjdoai open."
end tell'
```
