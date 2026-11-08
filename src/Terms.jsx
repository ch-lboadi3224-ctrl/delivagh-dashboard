import React from "react";
import { SiteFooter, SiteNav, SitePage } from "./ui/Site";

export default function Terms() {
  return (
    <SitePage>
      <SiteNav back />
      <main className="st-wrap st-doc">
        <div className="st-doc-head">
          <p className="st-eyebrow">Legal</p>
          <h1 className="st-h1">Terms of Service</h1>
          <p className="st-doc-meta">
            <span><strong>Effective date:</strong> 21 May 2026</span>
            <span><strong>Last updated:</strong> 21 May 2026</span>
            <span><strong>Governing law:</strong> Republic of Ghana</span>
          </p>
        </div>
        <nav className="st-toc" aria-label="Contents">
          <div className="toc-title">Contents</div>
          <ol>
            <li><a href="#about">About DelivaGH</a></li>
            <li><a href="#acceptance">Acceptance of terms</a></li>
            <li><a href="#eligibility">Eligibility</a></li>
            <li><a href="#vendor-accounts">Vendor accounts</a></li>
            <li><a href="#vendor-obligations">Vendor obligations</a></li>
            <li><a href="#customers">Customers</a></li>
            <li><a href="#payments">Payments and fees</a></li>
            <li><a href="#prohibited">Prohibited conduct</a></li>
            <li><a href="#ip">Intellectual property</a></li>
            <li><a href="#liability">Limitation of liability</a></li>
            <li><a href="#termination">Termination</a></li>
            <li><a href="#disputes">Disputes and governing law</a></li>
            <li><a href="#changes">Changes to these terms</a></li>
            <li><a href="#contact">Contact</a></li>
          </ol>
        </nav>
        <article className="st-prose">
        <div className="highlight">
          <p>These Terms of Service are a legally binding agreement between you and Awochad Ventures, governed by the laws of Ghana including the <strong>Electronic Transactions Act, 2008 (Act 772)</strong> and the <strong>Electronic Communications Act, 2008 (Act 775)</strong>. Please read them carefully before using DelivaGH.</p>
        </div>

        <h2 id="about">1. About DelivaGH</h2>
        <p>DelivaGH is a WhatsApp-based order management platform that enables food vendors in Ghana to receive orders, manage menus, and accept mobile money payments through WhatsApp. The platform consists of a WhatsApp ordering bot and a web-based vendor dashboard available at <a href="https://delivagh.app">delivagh.app</a>.</p>
        <p>DelivaGH is operated by <strong>Awochad Ventures</strong>, a sole proprietorship registered in Ghana, Registration Number BN233472017, with its principal place of business at 4750 Street 1, Dansoman, Accra, Ghana.</p>

        <h2 id="acceptance">2. Acceptance of terms</h2>
        <p>By creating an account, accessing the DelivaGH dashboard, or placing an order through a DelivaGH-powered WhatsApp bot, you agree to be bound by these Terms of Service and our Privacy Policy.</p>
        <p>If you are registering as a vendor on behalf of a business, you represent that you have the authority to bind that business to these terms.</p>
        <p>If you do not agree to these terms, you must not use DelivaGH.</p>

        <h2 id="eligibility">3. Eligibility</h2>
        <p>To use DelivaGH as a vendor, you must:</p>
        <ul>
          <li>Be at least 18 years of age</li>
          <li>Be based in Ghana or operate a food business that sells to customers in Ghana</li>
          <li>Have a valid WhatsApp Business or personal WhatsApp number</li>
          <li>Provide accurate and truthful information during registration</li>
          <li>Comply with all applicable Ghanaian laws and regulations relating to the sale of food</li>
        </ul>
        <p>Customers placing orders must be at least 16 years of age or have the consent of a parent or guardian.</p>

        <h2 id="vendor-accounts">4. Vendor accounts</h2>
        <h3>4.1 Registration and approval</h3>
        <p>Vendor accounts are subject to approval by DelivaGH before access to the dashboard is granted. We reserve the right to decline any application without providing a reason. You will be notified of approval or rejection via WhatsApp or email.</p>

        <h3>4.2 Account security</h3>
        <p>You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately at <a href="mailto:hello@delivagh.app">hello@delivagh.app</a> if you suspect any unauthorised access to your account. We are not liable for losses resulting from unauthorised use of your account caused by your failure to keep credentials secure.</p>

        <h3>4.3 Account accuracy</h3>
        <p>You must keep your account information — including business name, contact number, location, menu items, and prices — accurate and up to date. Misleading information that causes customer harm may result in account suspension.</p>

        <h2 id="vendor-obligations">5. Vendor obligations</h2>
        <p>As a vendor using DelivaGH, you agree to:</p>
        <ul>
          <li><strong>Fulfil orders accurately</strong> — prepare and deliver or make available for pickup all confirmed orders in a timely manner and as described in your menu</li>
          <li><strong>Maintain accurate menus</strong> — keep your menu items, descriptions, and prices current and accurate at all times</li>
          <li><strong>Comply with food safety laws</strong> — comply with all applicable Ghanaian food safety and hygiene regulations, including the <strong>Food and Drugs Authority Act, 1992 (PNDCL 305B)</strong></li>
          <li><strong>Handle customer data responsibly</strong> — use customer information (names, phone numbers, order details) only for the purpose of fulfilling orders placed through DelivaGH. You must not use customer data for unsolicited marketing, share it with third parties, or retain it beyond what is necessary</li>
          <li><strong>Respond to disputes promptly</strong> — engage in good faith with customers who report issues with their orders</li>
          <li><strong>Not misuse the platform</strong> — not use DelivaGH for any unlawful purpose or in any way that could damage the platform or other users</li>
        </ul>

        <h2 id="customers">6. Customers</h2>
        <p>Customers who place orders through DelivaGH-powered bots acknowledge that:</p>
        <ul>
          <li>Their order is placed directly with the vendor, not with Awochad Ventures or DelivaGH</li>
          <li>DelivaGH is a technology platform that facilitates ordering — we are not responsible for the quality, preparation, safety, or delivery of food items</li>
          <li>Payment disputes relating to food quality or non-delivery should first be raised with the vendor directly</li>
          <li>Their WhatsApp number and order details will be shared with the vendor to enable fulfilment</li>
        </ul>

        <h2 id="payments">7. Payments and fees</h2>
        <h3>7.1 Customer payments</h3>
        <p>Customers may pay for orders via mobile money (MTN MoMo, Telecel Cash, AirtelTigo Money) through the WhatsApp bot. Payment processing is handled by Kora Payments Network Limited. By initiating a payment, you also agree to Kora&apos;s terms of service.</p>
        <p>Payments are processed in Ghana Cedis (GHS). Minimum order amount is GHS 10.00.</p>

        <h3>7.2 Vendor subscription fees</h3>
        <table>
          <tbody>
            <tr><th>Period</th><th>Fee</th></tr>
            <tr><td>First month</td><td>Free — no charge</td></tr>
            <tr><td>Monthly thereafter</td><td>GHS 99.00 per month</td></tr>
          </tbody>
        </table>
        <p>Subscription fees are charged monthly. DelivaGH takes <strong>0% commission</strong> on customer orders — the GHS 99 flat fee is the only charge to vendors.</p>

        <h3>7.3 Payment method</h3>
        <p>Subscription fees are payable via mobile money to Awochad Ventures. Invoices will be issued at the end of each free trial period and monthly thereafter. Failure to pay within 7 days of the invoice date may result in suspension of the vendor&apos;s account.</p>

        <h3>7.4 Refunds</h3>
        <p>Subscription fees are non-refundable except where required by applicable Ghanaian consumer protection law. If you cancel your account, you will retain access until the end of the current billing period.</p>

        <div className="warning">
          <p><strong>Note on payment processing:</strong> DelivaGH uses Kora Payments to process mobile money transactions. Transaction fees charged by Kora or mobile money networks may apply and are separate from the DelivaGH subscription fee. These fees are borne by the vendor as configured in their Kora merchant account.</p>
        </div>

        <h2 id="prohibited">8. Prohibited conduct</h2>
        <p>You must not use DelivaGH to:</p>
        <ul>
          <li>Sell items that are illegal under Ghanaian law, including prohibited substances or counterfeit goods</li>
          <li>Engage in fraudulent activity, including false orders, fake payment confirmations, or impersonating another business</li>
          <li>Harass, threaten, or abuse other users of the platform</li>
          <li>Scrape, copy, or reverse-engineer any part of the DelivaGH platform</li>
          <li>Interfere with the security or integrity of the platform, its servers, or networks</li>
          <li>Use the platform in a way that violates Meta&apos;s WhatsApp Business Policy or Terms of Service</li>
          <li>Collect or harvest personal data of other users beyond what is necessary to fulfil an order</li>
        </ul>
        <p>Violation of these prohibitions may result in immediate account termination and may be reported to relevant authorities.</p>

        <h2 id="ip">9. Intellectual property</h2>
        <p>All intellectual property rights in the DelivaGH platform — including the software, dashboard interface, bot logic, branding, and content created by Awochad Ventures — remain the exclusive property of Awochad Ventures.</p>
        <p>Vendors retain ownership of their menu content, business information, and any materials they upload to the platform. By uploading content, you grant Awochad Ventures a non-exclusive, royalty-free licence to display and use that content solely for the purpose of operating the platform on your behalf.</p>
        <p>You must not reproduce, distribute, or create derivative works from any part of the DelivaGH platform without prior written consent from Awochad Ventures.</p>

        <h2 id="liability">10. Limitation of liability</h2>
        <p>To the maximum extent permitted by Ghanaian law:</p>
        <ul>
          <li>DelivaGH and Awochad Ventures are not liable for the quality, safety, or legality of food items sold by vendors through the platform</li>
          <li>We are not liable for any loss or damage arising from platform downtime, payment processing delays, or failures of third-party services including WhatsApp, Kora Payments, or mobile money networks</li>
          <li>Our total liability to any vendor or customer in connection with these terms shall not exceed the subscription fees paid by that vendor in the 3 months preceding the claim</li>
          <li>We are not liable for indirect, consequential, or special losses including lost revenue or loss of business opportunity</li>
        </ul>
        <p>Nothing in these terms limits liability for death or personal injury caused by our negligence, or for fraudulent misrepresentation, to the extent such limitation is prohibited by law.</p>

        <h2 id="termination">11. Termination</h2>
        <h3>11.1 By you</h3>
        <p>Vendors may cancel their account at any time by contacting us at <a href="mailto:hello@delivagh.app">hello@delivagh.app</a>. Cancellation takes effect at the end of the current billing period. No refund is provided for the remaining period.</p>

        <h3>11.2 By us</h3>
        <p>We may suspend or terminate a vendor account immediately and without notice if:</p>
        <ul>
          <li>You materially breach these terms and fail to remedy the breach within 7 days of notice</li>
          <li>We reasonably believe your account is being used for fraudulent or illegal activity</li>
          <li>You repeatedly fail to fulfil orders or receive sustained customer complaints</li>
          <li>Continued provision of the service to you would violate applicable law or Meta&apos;s platform policies</li>
          <li>You fail to pay subscription fees within 14 days of the invoice date</li>
        </ul>
        <p>On termination, your access to the dashboard will cease and your bot will be deactivated. We will retain your data in accordance with our Privacy Policy and applicable law.</p>

        <h2 id="disputes">12. Disputes and governing law</h2>
        <p>These Terms of Service are governed by and construed in accordance with the laws of the <strong>Republic of Ghana</strong>.</p>
        <p>In the event of a dispute arising from or relating to these terms, the parties agree to first attempt to resolve the matter amicably by contacting us at <a href="mailto:hello@delivagh.app">hello@delivagh.app</a>.</p>
        <p>If the dispute cannot be resolved informally within 30 days, it shall be submitted to the jurisdiction of the courts of Ghana.</p>

        <h2 id="changes">13. Changes to these terms</h2>
        <p>We may update these Terms of Service from time to time. When we make material changes, we will update the effective date at the top of this page and notify active vendors via the email address on their account at least 14 days before the changes take effect.</p>
        <p>Continued use of DelivaGH after changes take effect constitutes your acceptance of the revised terms. If you do not agree to the revised terms, you must stop using the platform and cancel your account.</p>

        <h2 id="contact">14. Contact</h2>
        <p>For any questions relating to these Terms of Service, please contact us:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:hello@delivagh.app">hello@delivagh.app</a></li>
          <li><strong>WhatsApp:</strong> +233 20 916 7883</li>
          <li><strong>Address:</strong> Awochad Ventures, 4750 Street 1, Dansoman, Accra, Ghana</li>
        </ul>
        </article>
      </main>
      <SiteFooter />
    </SitePage>
  );
}