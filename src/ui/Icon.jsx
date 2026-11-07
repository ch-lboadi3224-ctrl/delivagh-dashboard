// One small icon set, one stroke weight, used by both dashboards.
const PATHS = {
    today: <><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></>,
    orders: <><path d="M6 3.5h12a1 1 0 0 1 1 1V20l-3-1.8-2.5 1.8L12 18.2 10.5 20 8 18.2 5 20V4.5a1 1 0 0 1 1-1Z" /><path d="M9 8.5h6M9 12h4" /></>,
    customers: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" /><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .6 3.4 2.2 4 4.7" /></>,
    menu: <><path d="M7 3v8.5M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11.5V21" /><path d="M17.5 21V3c-2.2 1-3.5 3.6-3.5 7v3.5h3.5" /></>,
    insights: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
    bell: <><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
    moon: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></>,
    logout: <><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 14.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5" /></>,
    chevronLeft: <><path d="m14.5 6-6 6 6 6" /></>,
    chevronRight: <><path d="m9.5 6 6 6-6 6" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.2a1 1 0 0 0 1 .8h7.4a1 1 0 0 0 1-.8L17.5 7" /></>,
    edit: <><path d="M14.5 5.5l4 4L9 19H5v-4z" /><path d="M12.5 7.5l4 4" /></>,
    phone: <><path d="M5 4h3.5l1.5 4-2 1.5a10 10 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" /></>,
    pin: <><path d="M12 21s-6.5-5.5-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.5 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>,
    copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" /></>,
    external: <><path d="M14 4h6v6M20 4l-8.5 8.5" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
    check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
    store: <><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" /></>,
    approvals: <><path d="M9 11.5l2.2 2.2L15.5 9.5" /><path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" /></>,
    webhook: <><path d="M4 6h16M4 12h10M4 18h6" /><circle cx="18" cy="16" r="3" /></>,
    coins: <><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" /><path d="M9.5 15.5c.7 1.1 2.9 2 5.5 2 3 0 5.5-1.1 5.5-2.5v-4c0-1.2-1.7-2.2-4.2-2.4" /></>,
    pulse: <><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></>,
    power: <><path d="M12 3.5v8" /><path d="M6.8 6.6a7.5 7.5 0 1 0 10.4 0" /></>,
    refresh: <><path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5" /><path d="M19.5 4v5h-5M4.5 20v-5h5" /></>,
    bot: <><rect x="4.5" y="7.5" width="15" height="11" rx="3" /><path d="M12 7.5V4.5M9 13h.01M15 13h.01M9.5 16h5" /></>,
    sidebar: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9 4.5v15" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    bike: <><circle cx="6" cy="16.5" r="3" /><circle cx="18" cy="16.5" r="3" /><path d="M6 16.5 9.5 9h5l3.5 7.5M12 16.5l-2.5-7.5M14 5.5h2.5" /></>,
    bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
    more: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
};

export default function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
            {PATHS[name] || null}
        </svg>
    );
}
