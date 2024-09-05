import { Form } from "@remix-run/react";
import { useRoutedFetcher } from "../fetcher";

export default function App() {
  const { data } = useRoutedFetcher<{ showForm: boolean }>("/");

  return (
    <div className="index">
      <div className="content">
        <h1>A short heading about [your app]</h1>
        <p>A tagline about [your app] that describes your value proposition.</p>
        {data.showForm && (
          <Form method="post" action="/auth/login">
            <label>
              <span>Shop domain</span>
              <input type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button type="submit">Log in</button>
          </Form>
        )}
        <ul>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li>
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
        </ul>
      </div>
    </div>
  );
}
