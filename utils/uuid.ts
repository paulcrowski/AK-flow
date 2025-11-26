
// Robust UUID Generator
// Handles environments where crypto.randomUUID might be missing
export const generateUUID = (): string => {
    // 1. Try native crypto.randomUUID
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback if it fails for some reason
        }
    }

    // 2. Try crypto.getRandomValues (Standard in most browsers)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        try {
            const buffer = new Uint8Array(16);
            crypto.getRandomValues(buffer);

            // Set version (4) and variant (10xx)
            buffer[6] = (buffer[6] & 0x0f) | 0x40;
            buffer[8] = (buffer[8] & 0x3f) | 0x80;

            const hex = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
            return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
        } catch (e) {
            // Fallback
        }
    }

    // 3. Math.random Fallback (Last resort, not cryptographically secure but functional)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
