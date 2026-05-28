import argparse
import os

SYSTEM_PROMPT = (
    "You are StoryDream, an AI that rewrites story passages for young children "
    "listening through TTS. Keep the original meaning, follow the target level exactly, "
    "use child-friendly English, and avoid complex, abstract, or unsafe expressions."
)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model_name", type=str, default="Qwen/Qwen2.5-7B-Instruct")
    p.add_argument("--adapter_dir", type=str, default="./models/adapters/qwen25-7b-lora-levels")
    p.add_argument("--infer_source", type=str, required=True)
    p.add_argument("--infer_level", type=str, default="Level 1")
    p.add_argument("--target_listener", type=str, default="")
    p.add_argument("--delivery_mode", type=str, default="tts_read_aloud")
    p.add_argument("--instruction", type=str, default="")
    p.add_argument("--infer_max_new_tokens", type=int, default=256)
    p.add_argument("--infer_temperature", type=float, default=0.7)
    p.add_argument("--infer_top_p", type=float, default=0.9)
    return p.parse_args()


def main():
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    args = parse_args()
    if not os.path.isdir(args.adapter_dir):
        raise ValueError(f"Adapter directory does not exist: {args.adapter_dir}")

    tokenizer = AutoTokenizer.from_pretrained(args.adapter_dir, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    torch_dtype = torch.bfloat16 if (torch.cuda.is_available() and torch.cuda.is_bf16_supported()) else (
        torch.float16 if torch.cuda.is_available() else torch.float32
    )
    base_model = AutoModelForCausalLM.from_pretrained(
        args.model_name,
        trust_remote_code=True,
        torch_dtype=torch_dtype,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    model = PeftModel.from_pretrained(base_model, args.adapter_dir)
    model.eval()

    user_content = (
        "Rewrite the source text for child readers.\n"
        f"Target level: {args.infer_level}\n"
    )
    if args.target_listener:
        user_content += f"Target listener: {args.target_listener}\n"
    if args.delivery_mode:
        user_content += f"Delivery mode: {args.delivery_mode}\n"
    if args.instruction:
        user_content += f"Instruction: {args.instruction}\n"
    user_content += f"\n[Source]\n{args.infer_source}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    model_inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    with torch.no_grad():
        output_ids = model.generate(
            **model_inputs,
            max_new_tokens=args.infer_max_new_tokens,
            do_sample=True,
            temperature=args.infer_temperature,
            top_p=args.infer_top_p,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_ids = output_ids[0][model_inputs["input_ids"].shape[1] :]
    generated_text = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    print("\n[GENERATED]\n")
    print(generated_text)


if __name__ == "__main__":
    main()
