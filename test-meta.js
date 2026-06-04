const PHONE_NUMBER_ID = "1206848682503221";
const ACCESS_TOKEN = "EAAPBEEOJtj8BRiZAv1gZCMCGRTjn7xh4KA3KSm35ZBOyZBRGRbJXT1q6savAftnNyWRhNmh6k2FXUhZBSjjk0IVhLt5XOg4vy7PKZCTS34XKg56jtUycnZBzRgja5jaRscgocF58qCAKTygB0vn0rJrS0bidhKY2DWbZC6ZCZAtsMbNTnbinUimdZAy9PrDVbXY6i54jPwUHqdkKunMj9iKGauZCEBysvapurbtbWcxZCkjAn2ZCDqGfG1VPJbLiCGWvBT8TguTVbyclTMvFZBG9dFEsDtfKSDp";
const TO = "+27 71 104 9647";

async function test() {
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: TO,
        type: "template",
        template: {
          name: "hello_world",
          language: {
            code: "en_US",
          },
        },
      }),
    }
  );

  const data = await response.json();

  console.log("STATUS:", response.status);
  console.log(JSON.stringify(data, null, 2));
}

test();