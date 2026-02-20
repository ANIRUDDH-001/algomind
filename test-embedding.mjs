const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=AIzaSyDiGfKWZ3IYrnA_MBd3ifFYd2e4AhAXlUY`

async function run() {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: { parts: [{ text: "hello" }] }
        })
    });

    if (!response.ok) {
        console.error("ERROR", response.status, await response.text());
    } else {
        const data = await response.json();
        console.log("SUCCESS", data.embedding?.__proto__, data.embedding?.values?.length);
    }
}
run();
