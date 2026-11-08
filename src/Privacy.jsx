import React from "react";
import { SiteFooter, SiteNav, SitePage } from "./ui/Site";

export default function Privacy() {
  return (
    <SitePage>
      <SiteNav back />
      <main className="st-wrap st-doc">
        <div className="st-doc-head">
          <p className="st-eyebrow">Legal</p>
          <h1 className="st-h1">Privacy Policy</h1>
          <p className="st-doc-meta">
            <span><strong>Effective date:</strong> 21 May 2026</span>
            <span><strong>Last updated:</strong> 21 May 2026</span>
            <span><strong>Governing law:</strong> Republic of Ghana</span>
          </p>
        </div>
        <nav className="st-toc" aria-label="Contents">
          <div className="toc-title">Contents</div>
          <ol>
            <li><a href="#who">Who we are</a></li>
            <li><a href="#collect">Information we collect</a></li>
            <li><a href="#use">How we use your information</a></li>
            <li><a href="#share">Who we share your information with</a></li>
            <li><a href="#retention">How long we keep your data</a></li>
            <li><a href="#rights">Your rights under Ghanaian law</a></li>
            <li><a href="#security">Security</a></li>
            <li><a href="#children">Children</a></li>
            <li><a href="#changes">Changes to this policy</a></li>
            <li><a href="#contact">Contact us</a></li>
          </ol>
        </nav>
        <article className="st-prose">
        <div className="highlight">
          <p>This Privacy Policy is governed by Ghana&apos;s <strong>Data Protection Act, 2012 (Act 843)</strong> and the <strong>Electronic Transactions Act, 2008 (Act 772)</strong>. By using DelivaGH, you consent to the collection and use of your information as described in this policy.</p>
        </div>

        <h2 id="who">1. Who we are</h2>
        <p>DelivaGH is a WhatsApp-based order management platform for food vendors in Ghana. It is operated by <strong>Awochad Ventures</strong>, a sole proprietorship registered in Ghana under the Registration of Business Names Act, 1962 (Act 151), Registration Number BN233472017.</p>
        <p><strong>Registered address:</strong> 4750, Street 1, Dansoman, Accra, Ghana</p>
        <p><strong>Contact email:</strong> <a href="mailto:hello@delivagh.app">hello@delivagh.app</a></p>
        <p>References to &quot;DelivaGH&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot; in this policy mean Awochad Ventures operating the DelivaGH platform.</p>

        <h2 id="collect">2. Information we collect</h2>
        <p>We collect information from two categories of users: <strong>vendors</strong> (food businesses who sign up to use DelivaGH) and <strong>customers</strong> (individuals who place orders through WhatsApp).</p>

        <h3>2.1 Information you provide directly</h3>
        <table>
          <tbody>
            <tr><th>Category</th><th>What we collect</th><th>Who provides it</th></tr>
            <tr><td>Account registration</td><td>Business name, email address, password, WhatsApp/phone number, business location</td><td>Vendors</td></tr>
            <tr><td>Business profile</td><td>Menu items, prices, delivery zones, operating hours, business description</td><td>Vendors</td></tr>
            <tr><td>Customer registration</td><td>Name, email address (optional), WhatsApp phone number</td><td>Customers</td></tr>
            <tr><td>Order information</td><td>Items ordered, quantities, delivery address or pickup preference, special instructions</td><td>Customers</td></tr>
            <tr><td>Payment information</td><td>Mobile money network and phone number used for payment. We do not store full MoMo PIN or card details.</td><td>Customers</td></tr>
          </tbody>
        </table>

        <h3>2.2 Information collected automatically</h3>
        <ul>
          <li><strong>WhatsApp message metadata</strong> — message IDs, timestamps, and delivery status provided by Meta&apos;s WhatsApp Cloud API when you interact with our bot</li>
          <li><strong>Session data</strong> — your conversation state and phase within the ordering flow, stored temporarily to maintain your session</li>
          <li><strong>Order history</strong> — a record of all orders placed through DelivaGH associated with your WhatsApp number</li>
          <li><strong>Usage logs</strong> — server logs recording API requests, errors, and system events for operational and security purposes</li>
        </ul>

        <h3>2.3 Information from third parties</h3>
        <ul>
          <li><strong>Meta / WhatsApp</strong> — your WhatsApp phone number and message content when you interact with our bot, provided through Meta&apos;s WhatsApp Business Cloud API</li>
          <li><strong>Kora Payments</strong> — transaction status, payment reference numbers, and confirmation of successful or failed payments</li>
        </ul>

        <h2 id="use">3. How we use your information</h2>
        <p>We use the information we collect for the following purposes:</p>
        <ul>
          <li><strong>Processing orders</strong> — to receive, confirm, and manage food orders placed through the WhatsApp bot</li>
          <li><strong>Processing payments</strong> — to initiate and verify mobile money payments via Kora Payments on behalf of vendors</li>
          <li><strong>Sending notifications</strong> — to send customers order confirmations, status updates, and payment receipts via WhatsApp</li>
          <li><strong>Vendor account management</strong> — to provide vendors with access to their dashboard, order history, and menu management tools</li>
          <li><strong>Customer recognition</strong> — to greet returning customers by name and offer to reorder previous orders</li>
          <li><strong>Platform security</strong> — to detect and prevent fraud, abuse, and unauthorised access</li>
          <li><strong>Legal compliance</strong> — to comply with applicable laws and regulations in Ghana, including responding to lawful requests from authorities</li>
          <li><strong>Service improvement</strong> — to understand how the platform is used and improve its features and reliability</li>
        </ul>
        <p>We do not use your information for advertising, and we do not sell your personal data to any third party.</p>

        <h2 id="share">4. Who we share your information with</h2>
        <p>We share your information only with the following parties, and only to the extent necessary to operate the platform:</p>

        <table>
          <tbody>
            <tr><th>Third party</th><th>What we share</th><th>Why</th></tr>
            <tr><td><strong>Meta Platforms (WhatsApp)</strong></td><td>Message content, phone numbers</td><td>To deliver messages through the WhatsApp Business API. Governed by Meta&apos;s Privacy Policy.</td></tr>
            <tr><td><strong>Kora Payments Network Limited</strong></td><td>Customer name, phone number, order amount, payment reference</td><td>To process mobile money payments. Governed by Kora&apos;s Privacy Policy and their KYC/AML obligations.</td></tr>
            <tr><td><strong>Supabase Inc.</strong></td><td>All platform data</td><td>Our database and authentication provider. Data is stored on servers within Supabase&apos;s infrastructure. Governed by Supabase&apos;s Data Processing Agreement.</td></tr>
            <tr><td><strong>Heroku (Salesforce)</strong></td><td>Server logs, application data in transit</td><td>Our backend application hosting provider.</td></tr>
            <tr><td><strong>Vendors</strong></td><td>Customer name, WhatsApp number, order details, delivery address</td><td>To enable vendors to fulfil orders placed through their DelivaGH storefront. Vendors are bound by these terms not to misuse customer data.</td></tr>
          </tbody>
        </table>

        <p>We may also disclose your information where required to do so by law, court order, or at the request of a competent authority in Ghana.</p>

        <h2 id="retention">5. How long we keep your data</h2>
        <table>
          <tbody>
            <tr><th>Data type</th><th>Retention period</th></tr>
            <tr><td>Order records</td><td>3 years from the date of the order</td></tr>
            <tr><td>Customer account data</td><td>For as long as the associated vendor account is active, plus 1 year</td></tr>
            <tr><td>Vendor account data</td><td>For as long as the account is active, plus 2 years after closure</td></tr>
            <tr><td>Payment transaction records</td><td>7 years, in compliance with financial record-keeping requirements under Ghana law</td></tr>
            <tr><td>Server logs</td><td>90 days</td></tr>
            <tr><td>WhatsApp session data</td><td>24 hours from last interaction, then deleted</td></tr>
            <tr><td>Message deduplication records</td><td>24 hours</td></tr>
          </tbody>
        </table>

        <h2 id="rights">6. Your rights under Ghanaian law</h2>
        <p>Under the <strong>Data Protection Act, 2012 (Act 843)</strong>, you have the following rights in relation to your personal data:</p>
        <ul>
          <li><strong>Right of access</strong> — you may request a copy of the personal data we hold about you</li>
          <li><strong>Right to correction</strong> — you may request that we correct inaccurate or incomplete personal data</li>
          <li><strong>Right to object</strong> — you may object to our processing of your personal data in certain circumstances</li>
          <li><strong>Right to erasure</strong> — you may request deletion of your personal data, subject to our legal obligations to retain certain records</li>
          <li><strong>Right to withdraw consent</strong> — where processing is based on consent, you may withdraw it at any time</li>
        </ul>
        <p>To exercise any of these rights, contact us at <a href="mailto:hello@delivagh.app">hello@delivagh.app</a>. We will respond within 21 days as required by Act 843.</p>
        <p>You also have the right to lodge a complaint with the <strong>Data Protection Commission of Ghana</strong> if you believe your data protection rights have been violated.</p>

        <h2 id="security">7. Security</h2>
        <p>We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, or disclosure. These measures include:</p>
        <ul>
          <li>Encrypted data transmission using HTTPS/TLS for all API communications</li>
          <li>Authentication and access controls on our vendor dashboard</li>
          <li>Webhook signature verification for payment notifications from Kora</li>
          <li>Supabase Row Level Security policies to restrict data access by role</li>
          <li>No storage of full MoMo PINs, card numbers, or sensitive payment credentials</li>
        </ul>
        <p>Despite these measures, no internet transmission is completely secure. We cannot guarantee absolute security of data transmitted to or from our platform.</p>

        <h2 id="children">8. Children</h2>
        <p>DelivaGH is not directed at children under the age of 16. We do not knowingly collect personal data from children. If you believe a child has provided us with their personal data, please contact us and we will delete it promptly.</p>

        <h2 id="changes">9. Changes to this policy</h2>
        <p>We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or the platform&apos;s features. When we make material changes, we will update the &quot;Last updated&quot; date at the top of this page. For significant changes, we will notify active vendors via the email address on their account. Continued use of DelivaGH after changes are posted constitutes your acceptance of the updated policy.</p>

        <h2 id="contact">10. Contact us</h2>
        <p>If you have any questions, concerns, or requests relating to this Privacy Policy or how we handle your personal data, please contact us:</p>
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