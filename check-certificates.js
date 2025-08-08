const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCertificates() {
  try {
    console.log('🔍 Checking certificates in database...\n');
    
    const certificates = await prisma.certificate.findMany({
      take: 5,
      select: {
        id: true,
        certificateNumber: true,
        certificatePath: true,
        participantId: true,
        cotId: true,
        signatureId: true,
        attendance: true,
        theoryScore: true,
        practiceScore: true,
        participant: {
          select: {
            name: true,
            idNumber: true,
          }
        },
        cot: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
          }
        }
      }
    });

    console.log(`📊 Total certificates found: ${certificates.length}\n`);
    
    if (certificates.length > 0) {
      console.log('📋 Sample certificate data:');
      certificates.forEach((cert, index) => {
        console.log(`\n${index + 1}. Certificate ID: ${cert.id}`);
        console.log(`   Certificate Number: ${cert.certificateNumber}`);
        console.log(`   Certificate Path: ${cert.certificatePath || '❌ NULL/MISSING'}`);
        console.log(`   Participant: ${cert.participant?.name || 'Unknown'} (${cert.participant?.idNumber})`);
        console.log(`   COT Status: ${cert.cot?.status}`);
        console.log(`   COT Period: ${cert.cot?.startDate} - ${cert.cot?.endDate}`);
        console.log(`   Scores: Theory=${cert.theoryScore}, Practice=${cert.practiceScore}`);
        console.log(`   Attendance: ${cert.attendance}`);
      });
    }

    // Check for certificates without certificate path
    const certsWithoutPath = await prisma.certificate.count({
      where: {
        certificatePath: null
      }
    });
    
    console.log(`\n❌ Certificates without certificate path: ${certsWithoutPath}`);

    // Check for certificates from completed COTs
    const completedCotsCerts = await prisma.certificate.count({
      where: {
        cot: {
          status: 'Selesai'
        }
      }
    });
    
    console.log(`✅ Certificates from completed COTs: ${completedCotsCerts}`);

  } catch (error) {
    console.error('❌ Error checking certificates:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCertificates();
