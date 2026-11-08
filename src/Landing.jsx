import React, { useEffect } from "react";
import Icon from "./ui/Icon";
import { SiteFooter, SiteNav, SitePage } from "./ui/Site";

const BOT_ROWS = [
    ["Takes the order", "Customers type the way they talk, or send a voice note or a photo. The bot matches it to your menu and adds up the total."],
    ["Knows your area", "It knows where you deliver and where customers pick up. Anything it isn't sure about, it says you'll confirm."],
    ["Keeps customers posted", "When you accept an order, start preparing or send it out, the customer gets a WhatsApp message."],
    ["Remembers regulars", "Returning customers are greeted by name and can repeat their last order with one reply."],
];

const DASH_ROWS = [
    ["Orders as tickets", "New orders wait at the top and turn amber after five minutes, so none sits unanswered."],
    ["One tap per step", "Accept, start preparing, send out, mark delivered. Each step moves the order on."],
    ["Your menu, live", "Add items, change prices or hide something that's run out. The bot uses it straight away."],
    ["Customers and sales", "See who orders most and what sells, and send one message to all your customers."],
];

const PRICE_LIST = [
    "WhatsApp ordering bot, unlimited orders",
    "MoMo payments: MTN, Telecel, AirtelTigo",
    "Order dashboard on your phone or laptop",
    "Automatic order updates for customers",
    "0% commission on every order",
    "Support on WhatsApp",
];

export default function Landing() {
    useEffect(() => {
        const els = document.querySelectorAll(".st-reveal");
        if (!("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("is-in")); return undefined; }
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add("is-in"); obs.unobserve(e.target); }
            });
        }, { threshold: 0.12 });
        els.forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, []);

    return (
        <SitePage>
            <SiteNav />
            <main>
                <section className="st-hero">
                    <div className="st-wrap">
                        <div>
                            <p className="st-kicker"><span className="dx-led" />Live for shops in Ghana</p>
                            <h1 className="st-h1">Take orders on <em>WhatsApp.</em> Run them from one screen.</h1>
                            <p className="st-lede">Delivagh gives your shop a WhatsApp bot that takes orders, works out the total and asks how the customer will pay. You see each order arrive and move it along with one tap.</p>
                            <div className="st-actions">
                                <a href="/signup" className="dx-btn is-primary">Create a shop account<Icon name="chevronRight" size={16} /></a>
                                <a href="#how" className="dx-btn">See how it works</a>
                            </div>
                            <ul className="st-facts">
                                <li><Icon name="check" size={15} />First month free</li>
                                <li><Icon name="check" size={15} />About 5 minutes to set up</li>
                                <li><Icon name="check" size={15} />MTN, Telecel and AirtelTigo MoMo</li>
                            </ul>
                        </div>

                        <div className="st-demo" aria-hidden="true">
                            <div className="dx-phone">
                                <div className="who">A customer and your shop's bot</div>
                                <div className="msg out">Hi, 2 jollof and 1 sobolo please<small>12:41</small></div>
                                <div className="msg in">Added 2× Jollof Rice with Chicken and 1× Sobolo. That's GHS 100.00. Pickup or delivery?<small>12:41</small></div>
                                <div className="msg out">Delivery to East Legon. No pepper on one<small>12:42</small></div>
                                <div className="msg in">Noted. Delivery is GHS 5.00, so your total is GHS 105.00. MoMo or cash?<small>12:42</small></div>
                            </div>
                            <div className="st-demo-ticket">
                                <header><strong>Ama Owusu</strong><span className="dx-tag is-attn">New · 1 min</span></header>
                                <ul>
                                    <li><span className="dx-qty num">2×</span> Jollof Rice with Chicken</li>
                                    <li><span className="dx-qty num">1×</span> Sobolo</li>
                                    <li className="faint">Delivery · East Legon · no pepper on one</li>
                                </ul>
                                <footer><strong className="num">GHS 105.00</strong><span className="dx-btn is-primary is-sm">Accept</span></footer>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="how" className="st-section">
                    <div className="st-wrap">
                        <div className="st-head st-reveal">
                            <div>
                                <p className="st-eyebrow">How it works</p>
                                <h2 className="st-h2">Set up in an afternoon, not a month</h2>
                            </div>
                            <p>No app for customers to download and no website to build. If you can use WhatsApp, you can run your shop on Delivagh.</p>
                        </div>
                        <ol className="st-how st-reveal">
                            <li>
                                <h3>Create your account</h3>
                                <p>Add your shop name, where you deliver and your menu. Most shops are done in about five minutes.</p>
                            </li>
                            <li>
                                <h3>Share your link</h3>
                                <p>Post your WhatsApp link on your status, Instagram or flyers. Customers tap it and start ordering in the chat.</p>
                            </li>
                            <li>
                                <h3>Accept and get paid</h3>
                                <p>Orders arrive in your dashboard as they come in. Customers pay with MTN, Telecel or AirtelTigo MoMo, straight to you.</p>
                            </li>
                        </ol>
                    </div>
                </section>

                <section id="features" className="st-section is-tint">
                    <div className="st-wrap">
                        <div className="st-head st-reveal">
                            <div>
                                <p className="st-eyebrow">What you get</p>
                                <h2 className="st-h2">The bot talks to customers. You run the shop.</h2>
                            </div>
                            <p>Made for food, grocery and retail shops in Ghana, with prices in cedis and payment by mobile money.</p>
                        </div>
                        <div className="st-split">
                            <div className="st-reveal">
                                <h3><Icon name="bot" size={18} />In WhatsApp</h3>
                                <ul className="st-rows">
                                    {BOT_ROWS.map(([t, d]) => <li key={t}><strong>{t}</strong><span>{d}</span></li>)}
                                </ul>
                            </div>
                            <div className="st-reveal">
                                <h3><Icon name="orders" size={18} />In your dashboard</h3>
                                <ul className="st-rows">
                                    {DASH_ROWS.map(([t, d]) => <li key={t}><strong>{t}</strong><span>{d}</span></li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="pricing" className="st-section">
                    <div className="st-wrap">
                        <div className="st-head st-reveal">
                            <div>
                                <p className="st-eyebrow">Pricing</p>
                                <h2 className="st-h2">One plan. No cut of your sales.</h2>
                            </div>
                            <p>No hidden fees and no commission on your orders. A flat monthly fee after your first month.</p>
                        </div>
                        <div className="st-price st-reveal">
                            <div className="st-price-main">
                                <span className="dx-tag is-accent">First month free</span>
                                <div className="st-amount num">GHS 99<small>/month</small></div>
                                <p>after your free first month. Cancel anytime.</p>
                                <div className="st-price-gap" />
                                <a href="/signup" className="dx-btn is-primary is-block">Start your free month</a>
                                <p className="dx-hint">No card needed to start.</p>
                            </div>
                            <ul className="st-price-list">
                                {PRICE_LIST.map(t => <li key={t}><Icon name="check" size={18} />{t}</li>)}
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="st-cta">
                    <div className="st-wrap">
                        <div>
                            <h2>Ready to take orders on WhatsApp?</h2>
                            <p>First month free · No setup fee · Cancel anytime</p>
                        </div>
                        <a href="/signup" className="dx-btn">Create a shop account<Icon name="chevronRight" size={16} /></a>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </SitePage>
    );
}
