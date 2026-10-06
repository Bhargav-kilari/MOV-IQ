-- Seed Standard Exercises
INSERT INTO exercises (name, description, primary_muscles, secondary_muscles, equipment, difficulty, exercise_type, instructions, thumbnail, model_url, ai_supported)
VALUES
(
    'Barbell Bench Press',
    'A foundational compound chest exercise performed lying flat on a bench while pressing a barbell upward.',
    ARRAY['Chest'],
    ARRAY['Triceps', 'Front Deltoids'],
    'Barbell',
    'Intermediate',
    'Weight & Reps',
    ARRAY[
        'Lie flat on the bench with your eyes directly under the barbell.',
        'Grip the bar slightly wider than shoulder-width with hands wrapped securely.',
        'Unrack the bar and stabilize it directly over your chest with straight arms.',
        'Lower the bar slowly to mid-chest while tucking elbows at roughly a 45-degree angle.',
        'Press the bar forcefully upward back to the starting locked position.'
    ],
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=500&auto=format&fit=crop&q=60',
    '/models/bench_press.glb',
    TRUE
),
(
    'Barbell Squat',
    'The king of lower body movements targeting quads, glutes, and core stabilization.',
    ARRAY['Quadriceps', 'Glutes'],
    ARRAY['Hamstrings', 'Lower Back', 'Calves'],
    'Barbell',
    'Intermediate',
    'Weight & Reps',
    ARRAY[
        'Rest the barbell across your upper traps and grip securely.',
        'Stand with feet shoulder-width apart, toes pointing slightly outward.',
        'Brace your core and initiate the movement by breaking at hips and knees simultaneously.',
        'Squat down until hips drop below knee crease.',
        'Drive through your entire foot to return to the starting standing position.'
    ],
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&auto=format&fit=crop&q=60',
    '/models/squat.glb',
    TRUE
),
(
    'Conventional Deadlift',
    'A full-body compound pull developing posterior chain strength from the floor.',
    ARRAY['Lower Back', 'Hamstrings', 'Glutes'],
    ARRAY['Lats', 'Traps', 'Forearms'],
    'Barbell',
    'Advanced',
    'Weight & Reps',
    ARRAY[
        'Stand with feet hip-width apart, barbell over mid-foot.',
        'Hinge at the hips and grip the bar just outside your legs.',
        'Bring shins to the bar, flatten your back, and pull chest up.',
        'Drive through the floor while keeping the bar close to your body.',
        'Lock out hips and knees at top, then reverse movement with control.'
    ],
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60',
    '/models/deadlift.glb',
    TRUE
),
(
    'Overhead Press (OHP)',
    'A classic vertical pressing movement for shoulder mass and upper-body power.',
    ARRAY['Shoulders'],
    ARRAY['Triceps', 'Upper Chest', 'Core'],
    'Barbell',
    'Intermediate',
    'Weight & Reps',
    ARRAY[
        'Hold the bar across your front delts with hands shoulder-width apart.',
        'Squeeze your glutes and brace your core tightly.',
        'Press the bar vertically upwards, moving head slightly back until bar clears.',
        'Lock out directly overhead with head neutral and shoulders shrugged slightly up.',
        'Lower with control back to clavicle.'
    ],
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=60',
    '/models/overhead_press.glb',
    TRUE
),
(
    'Pull-Up',
    'An elite upper body pulling movement building broad lats and grip strength.',
    ARRAY['Lats'],
    ARRAY['Biceps', 'Upper Back', 'Forearms'],
    'Bodyweight',
    'Intermediate',
    'Bodyweight Reps',
    ARRAY[
        'Grip the pull-up bar with hands slightly wider than shoulder-width, palms facing away.',
        'Hang freely with straight arms and engage your scapulae.',
        'Pull your elbows down toward your hips until your chin clears the bar.',
        'Pause momentarily at the top, squeezing your lats.',
        'Lower under strict control back to a dead hang.'
    ],
    'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500&auto=format&fit=crop&q=60',
    '/models/pullup.glb',
    TRUE
),
(
    'Dumbbell Bicep Curl',
    'An isolated bicep builder allowing independent arm work and wrist supination.',
    ARRAY['Biceps'],
    ARRAY['Forearms'],
    'Dumbbell',
    'Beginner',
    'Weight & Reps',
    ARRAY[
        'Stand holding dumbbells at your sides with neutral grip.',
        'Keep elbows pinned to your ribs as you curl the weights upward.',
        'Supinate (rotate) wrists so palms face upward as you reach peak contraction.',
        'Squeeze biceps at the top without swinging torso.',
        'Lower slowly under control back to the starting position.'
    ],
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500&auto=format&fit=crop&q=60',
    '/models/bicep_curl.glb',
    TRUE
),
(
    'Incline Dumbbell Press',
    'Upper chest focused pressing movement utilizing an adjustable bench at a 30-45 degree incline.',
    ARRAY['Upper Chest'],
    ARRAY['Front Deltoids', 'Triceps'],
    'Dumbbell',
    'Beginner',
    'Weight & Reps',
    ARRAY[
        'Sit on an incline bench with dumbbells resting on thighs.',
        'Kick dumbbells to shoulder level and lie back.',
        'Press dumbbells upward until arms are extended above chest.',
        'Lower dumbbells with control until weights are level with chest.',
        'Press back up, bringing weights slightly toward each other at top.'
    ],
    'https://images.unsplash.com/photo-1584466977773-e625c37cdd50?w=500&auto=format&fit=crop&q=60',
    '/models/incline_press.glb',
    FALSE
),
(
    'Tricep Rope Pushdown',
    'Cable isolation exercise emphasizing the lateral and medial heads of the triceps.',
    ARRAY['Triceps'],
    ARRAY['Forearms'],
    'Cable',
    'Beginner',
    'Weight & Reps',
    ARRAY[
        'Attach a rope to a high cable pulley.',
        'Stand upright, tuck elbows into your sides, and grip rope ends.',
        'Extend arms downward by contracting triceps.',
        'Spread the rope ends apart at the bottom for maximum contraction.',
        'Slowly return to start with elbows stationary.'
    ],
    'https://images.unsplash.com/photo-1530822847156-5df684ec5ee1?w=500&auto=format&fit=crop&q=60',
    '/models/tricep_pushdown.glb',
    FALSE
),
(
    'Lateral Raise',
    'Key isolation exercise targeting the lateral deltoid for broader shoulder silhouette.',
    ARRAY['Side Deltoids'],
    ARRAY['Traps'],
    'Dumbbell',
    'Beginner',
    'Weight & Reps',
    ARRAY[
        'Hold dumbbells at sides with a slight forward lean at hips.',
        'Raise arms out to sides with elbows slightly bent until parallel with floor.',
        'Lead with your elbows and avoid using momentum.',
        'Pause for a moment at parallel.',
        'Lower slowly back to start.'
    ],
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=60',
    '/models/lateral_raise.glb',
    FALSE
),
(
    'Lat Pulldown',
    'Cable machine exercise targeting the latissimus dorsi and upper back.',
    ARRAY['Lats'],
    ARRAY['Biceps', 'Rhomboids', 'Rear Deltoids'],
    'Cable',
    'Beginner',
    'Weight & Reps',
    ARRAY[
        'Sit on the bench with thighs secured beneath pads.',
        'Grip the wide bar with overhand grip wider than shoulders.',
        'Pull bar down towards upper chest while arching upper back slightly.',
        'Squeeze shoulder blades together at the bottom.',
        'Slowly extend arms back up under control.'
    ],
    'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=500&auto=format&fit=crop&q=60',
    '/models/lat_pulldown.glb',
    FALSE
)
ON CONFLICT DO NOTHING;
