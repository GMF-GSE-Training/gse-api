import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCertificates() {
  try {
    console.log('=== Checking Certificates ===');
    
    const certificates = await prisma.certificate.findMany({
      select: {
        id: true,
        certificateNumber: true,
        certificatePath: true,
        attendance: true,
        participantId: true,
        participant: {
          select: {
            name: true,
          }
        }
      },
      take: 10 // Just show first 10
    });

    console.log(`Found ${certificates.length} certificates (showing first 10):`);
    
    certificates.forEach((cert, index) => {
      console.log(`${index + 1}. Number: ${cert.certificateNumber}`);
      console.log(`   Path: ${cert.certificatePath || 'NULL'}`);
      console.log(`   Attendance: ${cert.attendance}`);
      console.log(`   Participant: ${cert.participant?.name || 'Unknown'}`);
      console.log(`   Has PDF: ${cert.certificatePath ? 'YES' : 'NO'}`);
      console.log('---');
    });

    // Check total count
    const totalCount = await prisma.certificate.count();
    console.log(`\nTotal certificates in database: ${totalCount}`);

    // Check how many have valid certificate paths
    const withPaths = await prisma.certificate.count({
      where: {
        certificatePath: {
          not: null
        }
      }
    });
    
    console.log(`Certificates with valid paths: ${withPaths}/${totalCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCertificates();
