import argparse
import inspect
import json
import os
import random
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd


LEVEL_COLUMNS = {
    "level_1": ["level_1", "level1", "lv1", "easy", "output_level_1"],
    "level_2": ["level_2", "level2", "lv2", "medium", "output_level_2"],
    "level_3": ["level_3", "level3", "lv3", "hard", "output_level_3"],
}

SOURCE_COLUMNS = ["source", "original", "text", "input", "story", "raw_text"]
SYSTEM_PROMPT = (
    "You are StoryDream, an AI that rewrites story passages for young children "
    "listening through TTS. Keep the original meaning, follow the target level exactly, "
    "use child-friendly English, and avoid complex, abstract, or unsafe expressions."
)


def _pick_first_key(row: Dict, keys: List[str]) -> Optional[str]:
    for k in keys:
        if k in row and row[k] is not None and str(row[k]).strip():
            return str(row[k])
    return None


def _load_json(path: str) -> List[Dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["data", "items", "records", "examples"]:
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    return []


def _load_jsonl(path: str) -> List[Dict]:
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _load_csv(path: str) -> List[Dict]:
    df = pd.read_csv(path)
    return df.fillna("").to_dict(orient="records")


def load_rows_from_dir(data_dir: str) -> List[Dict]:
    rows: List[Dict] = []
    for root, _, files in os.walk(data_dir):
        for name in files:
            path = os.path.join(root, name)
            lower = name.lower()
            try:
                if lower.endswith(".json"):
                    rows.extend(_load_json(path))
                elif lower.endswith(".jsonl"):
                    rows.extend(_load_jsonl(path))
                elif lower.endswith(".csv"):
                    rows.extend(_load_csv(path))
            except Exception as e:
                print(f"[WARN] skip {path}: {e}")
    return rows


def build_training_examples(rows: Iterable[Dict]) -> List[Dict[str, str]]:
    examples: List[Dict[str, str]] = []
    for idx, row in enumerate(rows):
        title = str(row.get("title", "")).strip()
        title_unit = str(row.get("title_unit", "")).strip()
        unit_id = str(row.get("unit_id", "")).strip()
        if title_unit:
            split_key = f"title_unit::{title_unit}"
        elif title and unit_id:
            split_key = f"title_unitid::{title}||{unit_id}"
        elif title:
            split_key = f"title::{title}"
        else:
            split_key = f"row_{idx}"

        row_level = str(row.get("level", "")).strip().lower()
        row_input = _pick_first_key(row, ["input", "source", "original", "text", "story", "raw_text"])
        row_output = _pick_first_key(row, ["output", "target", "answer"])

        if row_level and row_input and row_output:
            if "level 1" in row_level or row_level == "1":
                level_name = "level_1"
            elif "level 2" in row_level or row_level == "2":
                level_name = "level_2"
            elif "level 3" in row_level or row_level == "3":
                level_name = "level_3"
            else:
                level_name = row_level.replace(" ", "_")

            base_instruction = str(row.get("instruction", "")).strip()
            target_listener = str(row.get("target_listener", "")).strip()
            delivery_mode = str(row.get("delivery_mode", "")).strip()

            user_prompt = (
                "Rewrite the source text for child readers.\n"
                f"Target level: {level_name.replace('_', ' ').title()}\n"
            )
            if target_listener:
                user_prompt += f"Target listener: {target_listener}\n"
            if delivery_mode:
                user_prompt += f"Delivery mode: {delivery_mode}\n"
            if base_instruction:
                user_prompt += f"Instruction: {base_instruction}\n"
            user_prompt += f"\n[Source]\n{row_input}"

            examples.append(
                {
                    "system": SYSTEM_PROMPT,
                    "user": user_prompt,
                    "assistant": str(row_output).strip(),
                    "split_key": split_key,
                }
            )
            continue

        source = _pick_first_key(row, SOURCE_COLUMNS)
        if not source:
            continue

        for level_name, candidate_cols in LEVEL_COLUMNS.items():
            target = _pick_first_key(row, candidate_cols)
            if not target:
                continue

            base_instruction = str(row.get("instruction", "")).strip()
            target_listener = str(row.get("target_listener", "")).strip()
            delivery_mode = str(row.get("delivery_mode", "")).strip()

            user_prompt = (
                "Rewrite the source text for child readers.\n"
                f"Target level: {level_name.replace('_', ' ').title()}\n"
            )
            if target_listener:
                user_prompt += f"Target listener: {target_listener}\n"
            if delivery_mode:
                user_prompt += f"Delivery mode: {delivery_mode}\n"
            if base_instruction:
                user_prompt += f"Instruction: {base_instruction}\n"
            user_prompt += f"\n[Source]\n{source}"

            examples.append(
                {
                    "system": SYSTEM_PROMPT,
                    "user": user_prompt,
                    "assistant": str(target).strip(),
                    "split_key": split_key,
                }
            )

    return examples


def split_by_group(examples: List[Dict[str, str]], eval_size: float, seed: int):
    groups: Dict[str, List[Dict[str, str]]] = {}
    for ex in examples:
        groups.setdefault(ex["split_key"], []).append(ex)

    group_keys = list(groups.keys())
    rng = random.Random(seed)
    rng.shuffle(group_keys)

    eval_group_count = max(1, int(len(group_keys) * eval_size))
    eval_group_set = set(group_keys[:eval_group_count])

    train_examples: List[Dict[str, str]] = []
    eval_examples: List[Dict[str, str]] = []
    for key in group_keys:
        if key in eval_group_set:
            eval_examples.extend(groups[key])
        else:
            train_examples.extend(groups[key])

    return train_examples, eval_examples, len(group_keys), eval_group_count


def build_messages(example: Dict[str, str]) -> List[Dict[str, str]]:
    return [
        {"role": "system", "content": example["system"]},
        {"role": "user", "content": example["user"]},
    ]


def render_full_chat(example: Dict[str, str], tokenizer) -> str:
    messages = build_messages(example) + [{"role": "assistant", "content": example["assistant"]}]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)


def render_prompt_chat(example: Dict[str, str], tokenizer) -> str:
    messages = build_messages(example)
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)


@dataclass
class CausalLMCollator:
    tokenizer: Any
    max_length: int

    def __call__(self, features: List[Dict]):
        full_texts = [f["text"] for f in features]
        prompt_texts = [f["prompt_text"] for f in features]

        batch = self.tokenizer(
            full_texts,
            max_length=self.max_length,
            truncation=True,
            padding=True,
            return_tensors="pt",
        )
        prompt_batch = self.tokenizer(
            prompt_texts,
            max_length=self.max_length,
            truncation=True,
            padding=True,
            return_tensors="pt",
        )

        labels = batch["input_ids"].clone()
        labels[batch["attention_mask"] == 0] = -100
        prompt_lens = prompt_batch["attention_mask"].sum(dim=1)
        for i, p_len in enumerate(prompt_lens.tolist()):
            labels[i, :p_len] = -100
        batch["labels"] = labels
        return batch


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data_dir", type=str, default="./data/processed/finetune")
    p.add_argument("--model_name", type=str, default="Qwen/Qwen2.5-7B-Instruct")
    p.add_argument("--output_dir", type=str, default="./models/adapters/qwen25-7b-lora-levels")
    p.add_argument("--max_length", type=int, default=2048)
    p.add_argument("--batch_size", type=int, default=2)
    p.add_argument("--grad_accum", type=int, default=8)
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--eval_size", type=float, default=0.05)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--use_4bit", action="store_true")
    return p.parse_args()


def run_train(args):
    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        Trainer,
        TrainingArguments,
    )

    rows = load_rows_from_dir(args.data_dir)
    examples = build_training_examples(rows)
    if not examples:
        raise ValueError(
            "No training examples were built. Check your dataset schema. "
            f"source candidates={SOURCE_COLUMNS}, level candidates={LEVEL_COLUMNS}"
        )

    print(f"[INFO] loaded rows={len(rows)}, training examples={len(examples)}")

    train_examples, eval_examples, total_groups, eval_groups = split_by_group(
        examples, eval_size=args.eval_size, seed=args.seed
    )
    print(
        f"[INFO] split by title+unit_id groups: total_groups={total_groups}, "
        f"eval_groups={eval_groups}, train_samples={len(train_examples)}, eval_samples={len(eval_examples)}"
    )

    tokenizer = AutoTokenizer.from_pretrained(args.model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    train_ds = Dataset.from_list(
        [{"text": render_full_chat(ex, tokenizer), "prompt_text": render_prompt_chat(ex, tokenizer)} for ex in train_examples]
    )
    eval_ds = Dataset.from_list(
        [{"text": render_full_chat(ex, tokenizer), "prompt_text": render_prompt_chat(ex, tokenizer)} for ex in eval_examples]
    )

    supervised_token_counts: List[int] = []
    sample_size = min(2000, len(train_examples))
    for ex in train_examples[:sample_size]:
        full_ids = tokenizer(render_full_chat(ex, tokenizer), truncation=True, max_length=args.max_length)["input_ids"]
        prompt_ids = tokenizer(render_prompt_chat(ex, tokenizer), truncation=True, max_length=args.max_length)["input_ids"]
        supervised = max(0, len(full_ids) - len(prompt_ids))
        supervised_token_counts.append(supervised)
    if supervised_token_counts:
        avg_sup = sum(supervised_token_counts) / len(supervised_token_counts)
        zero_sup = sum(1 for x in supervised_token_counts if x == 0)
        print(
            f"[INFO] assistant supervised tokens (sampled {len(supervised_token_counts)} train ex): "
            f"min={min(supervised_token_counts)}, avg={avg_sup:.1f}, max={max(supervised_token_counts)}, zero={zero_sup}"
        )

    quant_config = None
    model_kwargs = {"trust_remote_code": True}
    if args.use_4bit:
        compute_dtype = torch.bfloat16 if (torch.cuda.is_available() and torch.cuda.is_bf16_supported()) else torch.float16
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=compute_dtype,
        )
        model_kwargs["quantization_config"] = quant_config
        model_kwargs["device_map"] = "auto"
        model_kwargs["torch_dtype"] = compute_dtype

    model = AutoModelForCausalLM.from_pretrained(args.model_name, **model_kwargs)
    if args.use_4bit:
        model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    training_kwargs = {
        "output_dir": args.output_dir,
        "overwrite_output_dir": True,
        "per_device_train_batch_size": args.batch_size,
        "gradient_accumulation_steps": args.grad_accum,
        "learning_rate": args.lr,
        "num_train_epochs": args.epochs,
        "logging_steps": 10,
        "eval_strategy": "steps",
        "eval_steps": 200,
        "save_steps": 200,
        "save_total_limit": 3,
        "bf16": torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
        "fp16": torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
        "report_to": "none",
        "remove_unused_columns": False,
    }
    accepted = set(inspect.signature(TrainingArguments.__init__).parameters.keys())
    filtered_kwargs = {k: v for k, v in training_kwargs.items() if k in accepted}
    training_args = TrainingArguments(**filtered_kwargs)

    collator = CausalLMCollator(tokenizer=tokenizer, max_length=args.max_length)
    trainer_kwargs = {
        "model": model,
        "args": training_args,
        "train_dataset": train_ds,
        "eval_dataset": eval_ds,
        "data_collator": collator,
        "tokenizer": tokenizer,
    }
    trainer_accepted = set(inspect.signature(Trainer.__init__).parameters.keys())
    trainer_kwargs = {k: v for k, v in trainer_kwargs.items() if k in trainer_accepted}
    trainer = Trainer(**trainer_kwargs)
    trainer.train()

    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"[INFO] adapter saved to {args.output_dir}")

def main():
    args = parse_args()
    run_train(args)


if __name__ == "__main__":
    main()
