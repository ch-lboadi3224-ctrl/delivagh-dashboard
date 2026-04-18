/** Ghana mobile: local 0XXXXXXXXX (10 digits) or +233XXXXXXXXX (9 after country code). */
export function normalizeGhanaPhone(input) {
    const raw = String(input || "").trim();
    const digits = raw.replace(/\D/g, "");
    if (!digits) return { e164: null, display: "", error: "Enter a Ghana mobile number" };

    let rest;
    if (digits.startsWith("233") && digits.length === 12) {
        rest = digits.slice(3);
    } else if (digits.startsWith("0") && digits.length === 10) {
        rest = digits.slice(1);
    } else if (digits.length === 9) {
        rest = digits;
    } else {
        return { e164: null, display: raw, error: "Use 10 digits (e.g. 0244000000) or +233 24 400 0000" };
    }

    if (!/^[235][0-9]{8}$/.test(rest)) {
        return { e164: null, display: raw, error: "That does not look like a valid Ghana mobile prefix" };
    }

    const e164 = `+233${rest}`;
    const display = `0${rest}`;
    return { e164, display, error: null };
}

export function validateBusinessName(raw) {
    const name = String(raw || "").trim();
    if (name.length < 2) return { ok: false, message: "Business name must be at least 2 characters" };
    if (name.length > 80) return { ok: false, message: "Business name is too long (max 80 characters)" };
    if (!/[a-zA-Z\u00C0-\u024F\u0400-\u04FF]/.test(name)) {
        return { ok: false, message: "Business name should include at least one letter" };
    }
    const lettersDigits = (name.match(/[a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/g) || []).length;
    if (lettersDigits < 2) return { ok: false, message: "Business name is too short or unclear" };
    return { ok: true, value: name };
}

/** Practical email check + normalisation (lowercase domain). */
export function normalizeEmail(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (!s) return { ok: false, value: "", message: "Email is required" };
    // One local@domain with TLD >= 2 chars; no spaces
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) {
        return { ok: false, value: s, message: "Enter a valid email address" };
    }
    const [local, domain] = s.split("@");
    if (local.length > 64 || !local.length) return { ok: false, value: s, message: "Enter a valid email address" };
    if (domain.includes("..") || local.startsWith(".") || local.endsWith(".")) {
        return { ok: false, value: s, message: "Enter a valid email address" };
    }
    return { ok: true, value: s, message: null };
}

export function validatePassword(password) {
    if (!password) return { ok: false, message: "Password is required" };
    const issues = [];
    if (password.length < 8) issues.push("at least 8 characters");
    if (!/[A-Z]/.test(password)) issues.push("one uppercase letter");
    if (!/[0-9]/.test(password)) issues.push("one number");
    if (issues.length) return { ok: false, message: "Password needs: " + issues.join(", ") };
    return { ok: true, message: null };
}
