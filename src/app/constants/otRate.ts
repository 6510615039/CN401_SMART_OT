// อัตราค่าจ้าง OT เริ่มต้น (บาท/ชม.) — ต้องตรงกับ DEFAULT_OT_RATE_WEEKDAY / DEFAULT_OT_RATE_HOLIDAY
// ใน smart_ot_backend/api/models.py ซึ่งเป็นค่าเริ่มต้นก่อนแอดมินตั้งค่าใน SystemSettings
export const OT_RATE_WEEKDAY = 60;
export const OT_RATE_HOLIDAY = 70;

export function otRate(dayType: string | undefined | null): number {
  return dayType === 'holiday' ? OT_RATE_HOLIDAY : OT_RATE_WEEKDAY;
}
