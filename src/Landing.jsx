import React, { useEffect } from "react";
import "./Landing.css";

export default function Landing() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".fade-up").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <nav>
        <a href="/" className="nav-logo">
          <span className="nav-logo-text">DelivaGH</span>
          <span className="nav-logo-dot"></span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nav-cta">
          <a href="/login" className="btn-ghost">Sign in</a>
          <a href="/signup" className="btn-primary">Get started free</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-circle"></div>
        <div className="hero-circle2"></div>
        <div className="hero-inner">
          <div>
            <div className="hero-tag">
              <span className="hero-tag-dot"></span>
              Now live in Ghana
            </div>
            <h1>Your food business,<br />on <em>WhatsApp.</em></h1>
            <p className="hero-sub">DelivaGH turns your WhatsApp number into a full ordering system. Customers browse your menu, place orders, and pay — all without leaving WhatsApp.</p>
            <div className="hero-actions">
              <a href="/signup" className="hero-btn-main">
                Start for free
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <a href="#how" className="hero-btn-sec">See how it works</a>
            </div>
            <div className="hero-proof">
              <span>First month free</span>
              <span className="hero-proof-dot"></span>
              <span>5 minute setup</span>
              <span className="hero-proof-dot"></span>
              <span>MTN, Telecel &​amp; AirtelTigo</span>
            </div>
          </div>

          <div className="phone-wrap">
            <div className="phone-badge2">
              <div>
                <div className="phone-badge2-text">Order #A3F2</div>
                <div className="phone-badge2-val">GHS 80 · Paid</div>
              </div>
            </div>
            <div className="phone">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="wa-header">
                  <div className="wa-avatar">D</div>
                  <div>
                    <div className="wa-name">DelivaGH</div>
                    <div className="wa-status">Kelewele Hub</div>
                  </div>
                </div>
                <div className="wa-msgs">
                  <div className="msg msg-in">
                    Hi Kwame! Welcome to Kelewele Hub. What can I get for you?
                    <div className="msg-time">2:14 PM</div>
                    <div className="msg-btn-wrap">
                      <div className="msg-btn">View menu</div>
                      <div className="msg-btn">Track my order</div>
                    </div>
                  </div>
                  <div className="msg msg-out">
                    View menu
                    <div className="msg-time">2:14 PM ✓✓</div>
                  </div>
                  <div className="msg msg-in">
                    Here&​apos;s our menu:
                    1. Kelewele — GHS 15
                    2. Jollof Rice — GHS 25
                    3. Chicken Special — GHS 50
                    <div className="msg-time">2:15 PM</div>
                    <div className="msg-btn-wrap">
                      <div className="msg-btn">Add to cart</div>
                    </div>
                  </div>
                  <div className="msg msg-out">
                    2x Jollof Rice please
                    <div className="msg-time">2:16 PM ✓✓</div>
                  </div>
                  <div className="msg msg-in">
                    Got it! 2x Jollof Rice — GHS 50.
                    Confirm order?
                    <div className="msg-time">2:16 PM</div>
                    <div className="msg-btn-wrap">
                      <div className="msg-btn">Confirm &​amp; Pay</div>
                      <div className="msg-btn">Edit order</div>
                    </div>
                  </div>
                </div>
                <div className="wa-input">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#ccc" strokeWidth="1" /><path d="M7 4v3l2 2" stroke="#ccc" strokeWidth="1" strokeLinecap="round" /></svg>
                  Type a message
                </div>
              </div>
            </div>
            <div className="phone-badge">
              <div className="phone-badge-dot"></div>
              <div>
                <div className="phone-badge-text">Order confirmed</div>
                <div className="phone-badge-sub">Payment received via MoMo</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="section">
          <div className="fade-up">
            <div className="section-label">How it works</div>
            <h2 className="section-title">Up and running in minutes</h2>
            <p className="section-sub">No technical knowledge needed. If you can use WhatsApp, you can use DelivaGH.</p>
          </div>
          <div className="steps fade-up">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-title">Create your account</div>
              <p className="step-text">Sign up, add your business name, location, and upload your menu. Takes about 5 minutes.</p>
              <div className="step-line"></div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-title">Share your WhatsApp link</div>
              <p className="step-text">You get a unique link. Share it on Instagram, Facebook, or anywhere. Customers tap and order directly on WhatsApp.</p>
              <div className="step-line"></div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-title">Manage &​amp; get paid</div>
              <p className="step-text">Orders come into your dashboard in real time. Customers pay via MTN, Telecel, or AirtelTigo MoMo — straight to you.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-wrap">
        <div className="features-inner">
          <div className="section-label fade-up">What you get</div>
          <h2 className="section-title fade-up">Everything a food vendor needs</h2>
          <p className="section-sub fade-up">Built specifically for food businesses in Ghana. Not a generic tool adapted for Africa — built here, for here.</p>
          <div className="features-grid fade-up">
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" /></svg>
              </div>
              <div className="feature-title">WhatsApp ordering bot</div>
              <p className="feature-text">Customers browse your menu, add to cart, and confirm orders — all inside WhatsApp. No app download, no website needed.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
              </div>
              <div className="feature-title">MoMo payments</div>
              <p className="feature-text">Accept payments from MTN MoMo, Telecel Cash, and AirtelTigo Money. Customers get an OTP prompt right in the chat.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
              </div>
              <div className="feature-title">Order dashboard</div>
              <p className="feature-text">See every order in real time. Update status from New → Preparing → Ready and the bot notifies the customer automatically.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <div className="feature-title">Order status updates</div>
              <p className="feature-text">Customers always know where their order is. The bot sends automatic updates at every stage so you handle fewer &​quot;where is my food&​quot; messages.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>
              <div className="feature-title">Menu management</div>
              <p className="feature-text">Add, edit, and remove items from your menu anytime from your dashboard. Changes go live on the bot instantly.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
              </div>
              <div className="feature-title">Customer recognition</div>
              <p className="feature-text">Returning customers are greeted by name and offered their previous order with one tap. Makes reordering effortless.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-wrap">
        <div className="pricing-inner">
          <div className="section-label fade-up">Pricing</div>
          <h2 className="section-title fade-up">Simple, honest pricing</h2>
          <p className="section-sub fade-up">No hidden fees. No commission on your orders. Just a flat monthly fee after your first month.</p>
          <div className="pricing-card fade-up">
            <div className="pricing-badge">First month free</div>
            <div className="pricing-amount">GHS 99<span>/mo</span></div>
            <div className="pricing-period">after your free first month — cancel anytime</div>
            <ul className="pricing-list">
              <li>
                <div className="pricing-check"><svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#1a7a3c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                WhatsApp ordering bot — unlimited orders
              </li>
              <li>
                <div className="pricing-check"><svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#1a7a3c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                MoMo payments — MTN, Telecel, AirtelTigo
              </li>
              <li>
                <div className="pricing-check"><svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#1a7a3c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                Order management dashboard
              </li>
              <li>
                <div className="pricing-check"><svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#1a7a3c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                Automatic customer order updates
              </li>
              <li>
                <div className="pricing-check"><svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#1a7a3c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                0% commission on every order
              </li>
              <li>
                <div className="pricing-check"><svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#1a7a3c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                WhatsApp support
              </li>
            </ul>
            <a href="/signup" className="pricing-btn">Get started — first month free</a>
            <p className="pricing-note">No credit card required to start.</p>
          </div>
        </div>
      </section>

      <section className="cta-wrap">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to start taking orders on WhatsApp?</h2>
          <p className="cta-sub">Join food vendors across Ghana already using DelivaGH to manage orders and get paid faster.</p>
          <a href="/signup" className="cta-btn">
            Create your free account
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <p className="cta-note">First month free &​nbsp;·&​nbsp; No setup fees &​nbsp;·&​nbsp; Cancel anytime</p>
        </div>
      </section>

      <footer>
        <div className="footer-logo">
          <span className="footer-logo-text">DelivaGH</span>
          <span className="footer-logo-dot"></span>
        </div>
        <p className="footer-text">DelivaGH is a product of Awochad Ventures<br />Dansoman, Accra, Ghana &​nbsp;·&​nbsp; delivagh.app</p>
        <div className="footer-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
}