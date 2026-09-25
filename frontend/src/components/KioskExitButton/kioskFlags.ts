// 키오스크(전체화면) 실행 여부와 관련 설정을 최초 진입 URL 쿼리에서 읽어
// sessionStorage 에 저장해둔다. 라우터로 페이지를 옮기면 쿼리스트링이 사라지므로
// 한 번 읽어두면 이후 어느 페이지에서도 재사용할 수 있다.

const KIOSK_KEY = "sd:kiosk";
const PORT_KEY = "sd:quitPort";
const CONFIRM_KEY = "sd:kioskConfirm";

export interface KioskFlags {
  isKiosk: boolean;
  port: string;
  /** 아이가 실수로 눌러 앱이 꺼지는 걸 막기 위해 기본은 확인창을 띄운다. */
  needsConfirm: boolean;
}

export function readKioskFlags(): KioskFlags {
  const params = new URLSearchParams(window.location.search);

  if (params.get("kiosk") === "1") {
    sessionStorage.setItem(KIOSK_KEY, "1");

    const port = params.get("quitPort");
    if (port) sessionStorage.setItem(PORT_KEY, port);

    const confirm = params.get("kioskConfirm");
    if (confirm) sessionStorage.setItem(CONFIRM_KEY, confirm);
  }

  return {
    isKiosk: sessionStorage.getItem(KIOSK_KEY) === "1",
    port: sessionStorage.getItem(PORT_KEY) ?? "5174",
    needsConfirm: sessionStorage.getItem(CONFIRM_KEY) !== "0",
  };
}
