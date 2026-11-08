import React, { useEffect, useState } from "react";
import Icon from "./Icon";
import "./dash.css";
import "./site.css";

// Header and footer shared by the landing page and the legal pages.
export function SiteNav({ back = false }) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        // #root can be the scroller (index.css), so listen on the document in capture mode.
        const onScroll = (e) => {
            const el = e?.target;
            const y = el && el !== document && el.scrollTop !== undefined ? el.scrollTop : window.scrollY;
            setScrolled(y > 8);
        };
        document.addEventListener("scroll", onScroll, { passive: true, capture: true });
        return () => document.removeEventListener("scroll", onScroll, { capture: true });
    }, []);

    return (
        <header className={`st-nav${scrolled ? " is-scrolled" : ""}`}>
            <div className="st-wrap">
                <a href="/" className="dx-wordmark" aria-label="Delivagh home">Delivagh<i>.</i></a>
                {back ? (
                    <a href="/" className="st-back"><Icon name="chevronLeft" size={16} />Back to home</a>
                ) : (
                    <>
                        <nav className="st-links" aria-label="Sections">
                            <a href="#how">How it works</a>
                            <a href="#features">What you get</a>
                            <a href="#pricing">Pricing</a>
                        </nav>
                        <div className="st-nav-cta">
                            <a href="/login" className="dx-btn is-ghost">Sign in</a>
                            <a href="/signup" className="dx-btn is-primary">Create an account</a>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="st-foot">
            <div className="st-wrap">
                <span className="dx-wordmark">Delivagh<i>.</i></span>
                <p>Delivagh is a product of Awochad Ventures<br />Dansoman, Accra, Ghana</p>
                <nav aria-label="Legal">
                    <a href="/privacy">Privacy</a>
                    <a href="/terms">Terms</a>
                    <a href="mailto:hello@delivagh.app">Contact</a>
                </nav>
            </div>
        </footer>
    );
}

export function SitePage({ children }) {
    useEffect(() => {
        document.body.style.background = "#f4f2ec";
        return () => { document.body.style.background = ""; };
    }, []);
    return <div className="dx st" data-theme="light">{children}</div>;
}
