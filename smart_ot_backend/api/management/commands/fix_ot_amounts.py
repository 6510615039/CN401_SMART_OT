"""
Management command: fix_ot_amounts
Recalculates OTRequest.amount for all records using the correct formula:
  amount = floor(ot_hours) * rate  (rate: 60 weekday / 70 holiday)

Run with:
  python manage.py fix_ot_amounts          # preview changes (dry-run)
  python manage.py fix_ot_amounts --apply  # actually save to DB
"""

import math
from django.core.management.base import BaseCommand
from api.models import OTRequest


class Command(BaseCommand):
    help = 'Recalculate OTRequest.amount using floor(ot_hours) × flat rate (60/70)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Apply changes to the database (default is dry-run)',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        qs = OTRequest.objects.all()

        fixed = 0
        skipped = 0

        for req in qs:
            rate = 70 if req.day_type == 'holiday' else 60
            floored_hours = math.floor(float(req.ot_hours))
            correct_amount = floored_hours * rate

            current_amount = int(float(req.amount))

            if current_amount != correct_amount:
                self.stdout.write(
                    f'  [{req.id}] {req.staff.get_full_name()} {req.work_date} | '
                    f'ot_hours={req.ot_hours} → floor={floored_hours} | '
                    f'amount: {current_amount} → {correct_amount}'
                )
                if apply:
                    req.amount = correct_amount
                    req.save(update_fields=['amount'])
                fixed += 1
            else:
                skipped += 1

        mode = 'APPLIED' if apply else 'DRY-RUN (use --apply to save)'
        self.stdout.write(self.style.SUCCESS(
            f'\n{mode}: {fixed} records need fixing, {skipped} already correct.'
        ))
        if not apply and fixed > 0:
            self.stdout.write('Run with --apply to apply changes.')
