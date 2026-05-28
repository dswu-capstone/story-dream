# Qwen2.5-7B + LoRA (아동 난이도 3단계)

## 1) 설치
```powershell
pip install torch transformers datasets peft accelerate bitsandbytes pandas
```

## 2) 데이터 형식
`storydream_datasets` 폴더 아래의 `json/jsonl/csv`를 자동 로드합니다.

- 원문 컬럼 후보: `source`, `original`, `text`, `input`, `story`, `raw_text`
- Level 1 컬럼 후보: `level_1`, `level1`, `lv1`, `easy`, `output_level_1`
- Level 2 컬럼 후보: `level_2`, `level2`, `lv2`, `medium`, `output_level_2`
- Level 3 컬럼 후보: `level_3`, `level3`, `lv3`, `hard`, `output_level_3`

각 row에서 원문 + 존재하는 레벨 출력값만 학습 예제로 변환됩니다.

## 3) 학습 실행
```powershell
python train_qwen25_lora_levels.py --data_dir storydream_datasets --use_4bit --output_dir outputs/qwen25-7b-lora-levels
```

## 4) 주요 옵션
- `--max_length` 기본 1024
- `--batch_size` 기본 2
- `--grad_accum` 기본 8
- `--epochs` 기본 3
- `--lr` 기본 2e-4

