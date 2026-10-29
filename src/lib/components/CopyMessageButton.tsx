import { useState } from "react";
import { CheckIcon, CopyIcon } from "../icons";

export function CopyMessageButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            return;
        }
        setCopied(true);
        setToast(true);
        window.setTimeout(() => {
            setCopied(false);
            setToast(false);
        }, 1600);
    }

    return (
        <>
            <button type="button" className="copy" aria-label="Copy message" onClick={() => void copy()}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                <span className="tip">Copy message</span>
            </button>
            {toast ? (
                <p className="toast" role="status">
                    Copied
                </p>
            ) : null}
        </>
    );
}