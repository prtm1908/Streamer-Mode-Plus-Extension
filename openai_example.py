import openai

# API key embedded in code (not recommended for production)
openai.api_key = "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"

def call_openai_api():
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, how are you?"}
            ],
            max_tokens=150,
            temperature=0.7
        )

        print("Response from OpenAI:")
        print(response.choices[0].message.content)

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")

if __name__ == "__main__":
    call_openai_api()