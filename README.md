# 교생 안내 보드

모바일, 태블릿, PC에서 서로 다른 레이아웃으로 보이는 반응형 교생 안내 보드 프로토타입입니다.

## 구성

- 모바일: 아이콘형 홈 + 상세 패널
- 태블릿: 2열 대시보드
- PC: 월간 캘린더 중심 대시보드
- 급식: 식품안전나라 학교급식 페이지를 서버에서 조회
- 반 운영 정보: `data/dashboard.json`에서 관리

## 실행

1. `config.example.json`을 복사해서 `config.local.json`을 만듭니다.
2. `config.local.json`에 학교 지역과 학교명을 입력합니다.
3. 아래 명령으로 서버를 실행합니다.

```powershell
& "C:\Users\SDHS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\server.js
```

4. 브라우저에서 `http://127.0.0.1:4173` 접속

## 데이터 수정

- 전달사항, 시간표, 일정, 청소표, 1인 1역:
  - `data/dashboard.json`
- 급식 조회 설정:
  - `config.local.json`

## 식품안전나라 참고

- 급식 조회 페이지: https://www.foodsafetykorea.go.kr/portal/sensuousmenu/schoolMealsDetail.do?menu_grp=MENU_NEW03&menu_no=3017

## 메모

- 급식 데이터는 서버에서 불러오므로 화면에서는 학교명과 지역만 관리하면 됩니다.
- `schoolCode`를 직접 알고 있으면 넣어도 되고, 비워두면 학교명과 지역으로 자동 검색합니다.
- 학생 사진 명렬표는 현재 자리만 준비되어 있고, 실제 사진 데이터 연결은 다음 단계에서 붙이면 됩니다.
