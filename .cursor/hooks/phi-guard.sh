#!/usr/bin/env python3
# Hook: phi-guard
# Event: beforeSubmitPrompt
# Mục đích: Phát hiện thông tin nhận dạng bệnh nhân (PHI - Protected Health Information)
# trong prompt trước khi gửi đến AI model. Cảnh báo người dùng về nguy cơ rò rỉ dữ liệu.
# Quan trọng với hệ thống y tế theo quy định bảo vệ dữ liệu sức khỏe.

import sys
import json
import re

def load_input():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}

def check_phi(text: str) -> list[dict]:
    """
    Kiểm tra các mẫu PHI phổ biến trong ngữ cảnh y tế Việt Nam.
    Trả về danh sách các vi phạm phát hiện được.
    """
    issues = []

    # Mã hồ sơ bệnh án (MHBA) — thường 6-12 chữ số
    if re.search(r'\b(mhba|mã\s*hồ\s*sơ|mã\s*bệnh\s*án|patient\s*id|mrn)[\s:]+\d{4,12}\b', text, re.IGNORECASE):
        issues.append({
            "type": "MHBA",
            "message": "Phát hiện mã hồ sơ bệnh án (MHBA/Patient ID)"
        })

    # Số CMND/CCCD Việt Nam (9 hoặc 12 chữ số đứng độc lập)
    if re.search(r'\b\d{9}\b|\b\d{12}\b', text):
        issues.append({
            "type": "CMND_CCCD",
            "message": "Phát hiện số có thể là CMND/CCCD (9 hoặc 12 chữ số)"
        })

    # Ngày sinh dạng DD/MM/YYYY hoặc DD-MM-YYYY
    if re.search(r'\b(sinh\s*ngày|ngày\s*sinh|dob|date\s*of\s*birth)[\s:]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b', text, re.IGNORECASE):
        issues.append({
            "type": "DOB",
            "message": "Phát hiện ngày sinh bệnh nhân"
        })

    # Số điện thoại Việt Nam
    if re.search(r'\b(0|\+84)(3[2-9]|5[6-9]|7[0-9]|8[0-9]|9[0-9])\d{7}\b', text):
        issues.append({
            "type": "PHONE",
            "message": "Phát hiện số điện thoại (có thể là thông tin liên hệ bệnh nhân)"
        })

    # Địa chỉ email cá nhân trong ngữ cảnh y tế
    if re.search(r'\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b', text):
        issues.append({
            "type": "EMAIL",
            "message": "Phát hiện địa chỉ email"
        })

    # Từ khoá chỉ tên bệnh nhân cụ thể
    if re.search(r'\b(bệnh\s*nhân|patient)\s*:?\s*[A-ZÀÁẢÃẠĂẮẶẲẼẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắặẳẽặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+\s+[A-ZÀÁẢÃẠĂẮẶẲẼẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]', text):
        issues.append({
            "type": "PATIENT_NAME",
            "message": "Phát hiện tên bệnh nhân cụ thể trong prompt"
        })

    # JWT token hoặc API key bị paste nhầm
    if re.search(r'eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}', text):
        issues.append({
            "type": "JWT_TOKEN",
            "message": "Phát hiện JWT token — KHÔNG được đưa token vào prompt!"
        })

    if re.search(r'\b(sk-|anon\.|service_role\.|sb-)[A-Za-z0-9_\-]{16,}\b', text):
        issues.append({
            "type": "API_KEY",
            "message": "Phát hiện API key hoặc Supabase key — TUYỆT ĐỐI không commit hoặc share!"
        })

    return issues

def main():
    data = load_input()
    prompt = data.get("prompt", "")

    if not isinstance(prompt, str):
        print(json.dumps({"permission": "allow"}))
        return

    issues = check_phi(prompt)

    if not issues:
        print(json.dumps({"permission": "allow"}))
        return

    # Có JWT token hoặc API key → deny ngay (không thể để leak token)
    critical_types = {"JWT_TOKEN", "API_KEY"}
    has_critical = any(i["type"] in critical_types for i in issues)

    if has_critical:
        critical_msgs = [i["message"] for i in issues if i["type"] in critical_types]
        print(json.dumps({
            "permission": "deny",
            "user_message": (
                "🚨 CHẶN PROMPT — Phát hiện dữ liệu bảo mật nghiêm trọng:\n"
                + "\n".join(f"• {m}" for m in critical_msgs)
                + "\n\nVui lòng xoá thông tin nhạy cảm trước khi gửi."
            ),
            "agent_message": (
                "Prompt bị chặn vì chứa credentials/token bảo mật: "
                + "; ".join(critical_msgs)
            )
        }))
        return

    # PHI bệnh nhân → cảnh báo, yêu cầu xác nhận
    phi_msgs = [i["message"] for i in issues]
    print(json.dumps({
        "permission": "ask",
        "user_message": (
            "⚠️  CẢNH BÁO BẢO MẬT Y TẾ — Prompt có thể chứa thông tin nhận dạng bệnh nhân (PHI):\n"
            + "\n".join(f"• {m}" for m in phi_msgs)
            + "\n\nTheo quy định bảo mật dữ liệu y tế, không đưa thông tin cá nhân bệnh nhân "
            "vào prompt AI. Bạn có muốn tiếp tục không? (Hãy ẩn danh hoá dữ liệu trước khi gửi)"
        ),
        "agent_message": (
            "Người dùng vừa cố gửi prompt có thể chứa PHI bệnh nhân: "
            + "; ".join(phi_msgs)
            + ". Đây là cảnh báo bảo mật, người dùng đã được thông báo."
        )
    }))

if __name__ == "__main__":
    main()
